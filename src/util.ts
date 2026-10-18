import stripAnsi from 'strip-ansi'

// OSC (window title, systemd 3008 context, etc.), terminated by BEL or ESC \
const oscRegex = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g
// Complete CSI sequences (colors, cursor movement). Must run before `regex`,
// which only consumes the first parameter of e.g. ESC[01;32m and leaves ";32m"
const csiRegex = /\x1b\[[0-?]*[ -/]*[@-~]/g
const regex = /[\x08\x1b]((\[\??\d+[hl])|([=<>a-kzNM78])|([\(\)][a-b0-2])|(\[\d{0,2}\w)|(\[\d+;\d+[hfy]?)|(\[;?[hf])|(#[3-68])|([01356]n)|(O[mlnp-z]?)|(\/Z)|(\d+)|(\[\?\d;\d0c)|(\d;\dR))/gi

export function cleanupOutput (data: string): string {
    return stripAnsi(data.replace(oscRegex, '').replace(csiRegex, '').replace(regex, ''))
}
