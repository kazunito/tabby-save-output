import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sanitizeFilename from 'sanitize-filename'
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

        if (tab.sessionChanged$) { // v136+
            tab.sessionChanged$.subscribe(session => {
                if (session) {
                    this.attachToSession(session, tab)
                }
            })
        }
        if (tab.session) {
            this.attachToSession(tab.session, tab)
        }
    }

    private attachToSession (session: BaseSession, tab: BaseTerminalTabComponent<any>) {
        let outputPath = this.generatePath(tab)
        const stream = fs.createWriteStream(outputPath)
        let dataLength = 0
        let lineBuffer = ''

        // wait for the title to settle
        setTimeout(() => {
            let newPath = this.generatePath(tab)
            fs.rename(outputPath, newPath, err => {
                if (!err) {
                    outputPath = newPath
                }
            })
        }, 5000)

        session.output$.subscribe(data => {
            data = cleanupOutput(data)
            dataLength += data.length
            lineBuffer += data
            const newlineIdx = lineBuffer.lastIndexOf('\n')
            if (newlineIdx === -1) {
                return
            }
            const ready = lineBuffer.slice(0, newlineIdx + 1)
            lineBuffer = lineBuffer.slice(newlineIdx + 1)
            const lines = ready.split('\n')
            lines.pop() // trailing '' after final '\n'
            const prefix = `[${this.formatLineTimestamp(new Date())}] `
            const out = lines.map(l => prefix + (l.endsWith('\r') ? l.slice(0, -1) : l)).join('\n') + '\n'
            stream.write(out, 'utf8')
        })

        session.destroyed$.subscribe(() => {
            if (lineBuffer.length) {
                const prefix = `[${this.formatLineTimestamp(new Date())}] `
                stream.write(prefix + lineBuffer + '\n', 'utf8')
                lineBuffer = ''
            }
            stream.close()
            if (!dataLength) {
                fs.unlink(outputPath, () => null)
            }
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
