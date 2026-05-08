import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sanitizeFilename from 'sanitize-filename'
import { Terminal } from '@xterm/headless'
import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent, BaseSession } from 'tabby-terminal'
import SSHTabComponent from 'tabby-ssh'
import { cleanupOutput } from './util'

@Injectable()
export class SaveOutputDecorator extends TerminalDecorator {
    constructor (
        private config: ConfigService,
    ) {
        super()
    }

    attach (tab: BaseTerminalTabComponent<any>): void {
        if (this.config.store.saveOutput.autoSave === 'off' || this.config.store.saveOutput.autoSave === 'ssh' && !(tab instanceof SSHTabComponent)) {
            return
        }

        const attached = new WeakSet<BaseSession>()
        const tryAttach = (session: BaseSession | null | undefined) => {
            if (session && !attached.has(session)) {
                attached.add(session)
                this.attachToSession(session, tab)
            }
        }

        if (tab.sessionChanged$) { // v136+
            tab.sessionChanged$.subscribe(session => tryAttach(session))
        }
        if (tab.session) {
            tryAttach(tab.session)
        }
    }

    private attachToSession (session: BaseSession, tab: BaseTerminalTabComponent<any>) {
        let outputPath = this.generatePath(tab)
        const stream = fs.createWriteStream(outputPath)
        let dataLength = 0
        let lineBuffer = ''
        let inAltScreen = false
        let altScreenTerm: Terminal | null = null
        let queue: Promise<void> = Promise.resolve()

        // wait for the title to settle
        setTimeout(() => {
            let newPath = this.generatePath(tab)
            fs.rename(outputPath, newPath, err => {
                if (!err) {
                    outputPath = newPath
                }
            })
        }, 5000)

        // \r in terminal output means "cursor to column 0" — anything before it on
        // the line gets overwritten in the live display. For a static log we keep
        // only what follows the last \r on each line. A trailing \r is treated as
        // part of the \r\n line ending, not as a cursor return.
        const collapseCarriageReturns = (line: string): string => {
            if (line.endsWith('\r')) {
                line = line.slice(0, -1)
            }
            const lastCR = line.lastIndexOf('\r')
            return lastCR === -1 ? line : line.slice(lastCR + 1)
        }

        const writeTimestampedLines = (segment: string) => {
            const cleaned = cleanupOutput(segment)
            if (!cleaned) {
                return
            }
            lineBuffer += cleaned
            const nlIdx = lineBuffer.lastIndexOf('\n')
            if (nlIdx === -1) {
                return
            }
            const ready = lineBuffer.slice(0, nlIdx + 1)
            lineBuffer = lineBuffer.slice(nlIdx + 1)
            const lines = ready.split('\n')
            lines.pop() // trailing '' after final '\n'
            const prefix = `[${this.formatLineTimestamp(new Date())}] `
            const out = lines.map(l => prefix + collapseCarriageReturns(l)).join('\n') + '\n'
            stream.write(out, 'utf8')
        }

        const flushPartial = () => {
            if (lineBuffer.length) {
                const prefix = `[${this.formatLineTimestamp(new Date())}] `
                stream.write(prefix + collapseCarriageReturns(lineBuffer) + '\n', 'utf8')
                lineBuffer = ''
            }
        }

        const termSize = (): { cols: number, rows: number } => {
            const s = tab.size
            if (s && s.columns && s.rows) {
                return { cols: s.columns, rows: s.rows }
            }
            return { cols: 80, rows: 24 }
        }

        const resizeSub = tab.resize$.subscribe(size => {
            if (altScreenTerm && size.columns && size.rows) {
                try {
                    altScreenTerm.resize(size.columns, size.rows)
                } catch { /* ignore */ }
            }
        })

        const termWrite = (term: Terminal, data: string) =>
            new Promise<void>(resolve => term.write(data, () => resolve()))

        const enterAltScreen = () => {
            flushPartial()
            stream.write(`[${this.formatLineTimestamp(new Date())}] -- entering interactive mode --\n`, 'utf8')
            const { cols, rows } = termSize()
            altScreenTerm = new Terminal({ cols, rows, allowProposedApi: true })
            inAltScreen = true
        }

        const exitAltScreen = async () => {
            const term = altScreenTerm
            altScreenTerm = null
            inAltScreen = false
            if (term) {
                await termWrite(term, '') // ensure pending writes processed
                const lines: string[] = []
                const buffer = term.buffer.active
                for (let y = 0; y < term.rows; y++) {
                    const line = buffer.getLine(y)
                    lines.push(line ? line.translateToString(true) : '')
                }
                while (lines.length && !lines[lines.length - 1].trim()) {
                    lines.pop()
                }
                if (lines.length) {
                    stream.write(`[${this.formatLineTimestamp(new Date())}] -- final screen --\n`, 'utf8')
                    stream.write(lines.join('\n') + '\n', 'utf8')
                }
                term.dispose()
            }
            stream.write(`[${this.formatLineTimestamp(new Date())}] -- exiting interactive mode --\n`, 'utf8')
        }

        const processChunk = async (rawData: string) => {
            dataLength += rawData.length

            if (!this.config.store.saveOutput.lineTimestamps) {
                stream.write(cleanupOutput(rawData), 'utf8')
                return
            }

            // \x1b[?1049h / \x1b[?1047h / \x1b[?47h enter alt screen (top, vim, less, htop)
            // matching 'l' suffix exits. Detect before cleanupOutput strips the sequence.
            const matches = [...rawData.matchAll(/\x1b\[\?(?:1049|1047|47)([hl])/g)]
            let lastIdx = 0
            for (const m of matches) {
                const idx = m.index!
                const before = rawData.slice(lastIdx, idx)
                if (inAltScreen && altScreenTerm && before) {
                    await termWrite(altScreenTerm, before)
                } else if (!inAltScreen && before) {
                    writeTimestampedLines(before)
                }
                const isEnter = m[1] === 'h'
                if (isEnter && !inAltScreen) {
                    enterAltScreen()
                } else if (!isEnter && inAltScreen) {
                    await exitAltScreen()
                }
                lastIdx = idx + m[0].length
            }
            const tail = rawData.slice(lastIdx)
            if (inAltScreen && altScreenTerm && tail) {
                await termWrite(altScreenTerm, tail)
            } else if (!inAltScreen && tail) {
                writeTimestampedLines(tail)
            }
        }

        const enqueue = (fn: () => Promise<void> | void) => {
            queue = queue.then(() => fn()).catch(() => { /* swallow to keep chain alive */ })
        }

        session.output$.subscribe(rawData => {
            enqueue(() => processChunk(rawData))
        })

        session.destroyed$.subscribe(() => {
            resizeSub.unsubscribe()
            enqueue(async () => {
                if (inAltScreen) {
                    await exitAltScreen()
                }
                flushPartial()
                stream.close()
                if (!dataLength) {
                    fs.unlink(outputPath, () => null)
                }
            })
        })
    }

    private generatePath (tab: BaseTerminalTabComponent<any>): string {
        let outputPath = this.config.store.saveOutput.autoSaveDirectory || os.homedir()
        let outputName = this.formatLocalTimestamp(new Date()) + ' - ' + (tab.customTitle || tab.title || 'Untitled') + '.txt'
        outputName = sanitizeFilename(outputName)
        return path.join(outputPath, outputName)
    }

    private formatLocalTimestamp (d: Date): string {
        return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}T${this.pad(d.getHours())}-${this.pad(d.getMinutes())}-${this.pad(d.getSeconds())}.${this.pad(d.getMilliseconds(), 3)}`
    }

    private formatLineTimestamp (d: Date): string {
        return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`
    }

    private pad (n: number, width = 2): string {
        let s = String(n)
        while (s.length < width) s = '0' + s
        return s
    }
}
