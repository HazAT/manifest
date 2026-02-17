/**
 * Process runner for Manifest.
 *
 * Wraps any command with output logging and Spark error reporting.
 * Usage: bun manifest run <command> [args...]
 *
 * Sugar shortcuts:
 *   bun manifest run dev → bun --hot index.ts
 */

import fs from 'fs'
import path from 'path'

export const meta = {
  name: 'run',
  description: 'Run a command with output logging and Spark error reporting',
  usage: 'bun manifest run <command> [args...]',
}

/** Sugar shortcuts: short alias → full command */
const SUGAR: Record<string, string[]> = {
  dev: ['bun', '--hot', 'index.ts'],
}

/** Max lines kept in memory for Spark event tail */
const BUFFER_MAX_LINES = 200

/** Lines included in Spark event payload */
const TAIL_LINES = 50

function sanitizeName(command: string[]): string {
  return command
    .join('-')
    .replace(/\//g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80)
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export async function runProcess(
  command: string[],
  options?: { name?: string; cwd?: string; env?: Record<string, string> },
): Promise<{ exitCode: number; logFile: string }> {
  const name = options?.name || sanitizeName(command)
  const logsDir = path.join('.spark', 'logs')
  fs.mkdirSync(logsDir, { recursive: true })

  const logFile = path.join(logsDir, `${name}-${timestamp()}.log`)
  const logFd = fs.openSync(logFile, 'w')

  // In-memory ring buffer (last N lines)
  const buffer: string[] = []

  function pushToBuffer(text: string) {
    const lines = text.split('\n')
    for (const line of lines) {
      buffer.push(line)
      if (buffer.length > BUFFER_MAX_LINES) buffer.shift()
    }
  }

  // Track signal-forwarded kills
  let killedBySignal = false

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(command, {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : undefined,
    })
  } catch (err) {
    fs.closeSync(logFd)
    throw err
  }

  // Forward signals to child
  const onSIGINT = () => { killedBySignal = true; proc.kill('SIGINT') }
  const onSIGTERM = () => { killedBySignal = true; proc.kill('SIGTERM') }
  process.on('SIGINT', onSIGINT)
  process.on('SIGTERM', onSIGTERM)

  // Pipe stdout
  async function pipeStream(stream: ReadableStream<Uint8Array> | null, target: NodeJS.WriteStream) {
    if (!stream) return
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      target.write(text)
      fs.writeSync(logFd, text)
      pushToBuffer(text)
    }
  }

  await Promise.all([
    pipeStream(proc.stdout as ReadableStream<Uint8Array> | null, process.stdout),
    pipeStream(proc.stderr as ReadableStream<Uint8Array> | null, process.stderr),
  ])

  const exitCode = await proc.exited
  fs.closeSync(logFd)

  // Clean up signal handlers
  process.removeListener('SIGINT', onSIGINT)
  process.removeListener('SIGTERM', onSIGTERM)

  // Emit Spark event on non-zero exit (unless killed by signal)
  if (exitCode !== 0 && !killedBySignal) {
    try {
      const sparkConfig = (await import('../../config/spark')).default
      if (sparkConfig.enabled && sparkConfig.watch.processErrors) {
        const { sparkDb } = await import('../../services/sparkDb')
        const tail = buffer.slice(-TAIL_LINES).join('\n')
        sparkDb.logEvent({
          type: 'process-error',
          traceId: crypto.randomUUID(),
          command: command.join(' '),
          exitCode,
          logFile,
          tail,
          error: {
            message: `Process '${command.join(' ')}' exited with code ${exitCode}`,
          },
        })
      }
    } catch {} // Spark emission must never break the runner
  }

  return { exitCode, logFile }
}

export async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log(`
Usage: bun manifest run <command> [args...]

Run any command with output logging and Spark error reporting.
Logs are saved to .spark/logs/.

Sugar shortcuts:
  bun manifest run dev    →  bun --hot index.ts

Examples:
  bun manifest run bun test
  bun manifest run echo hello
  bun manifest run dev
`)
    process.exit(0)
  }

  // Resolve sugar shortcuts
  const sugar = args.length === 1 ? SUGAR[args[0]!] : undefined
  const command = sugar ?? args

  const { exitCode } = await runProcess(command)
  process.exit(exitCode)
}
