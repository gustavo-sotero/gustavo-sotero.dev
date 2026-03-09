/**
 * kill-ports.ts
 *
 * Frees the dev ports before `bun dev` starts.
 * Runs automatically via the `predev` npm lifecycle hook.
 *
 * Cross-platform: Windows (netstat + taskkill) and Unix (lsof + kill).
 */

const DEV_PORTS = [3000, 3001];

async function killPort(port: number): Promise<void> {
  if (process.platform === 'win32') {
    await killPortWindows(port);
  } else {
    await killPortUnix(port);
  }
}

async function killPortWindows(port: number): Promise<void> {
  const proc = Bun.spawnSync(['netstat', '-ano'], { stdout: 'pipe', stderr: 'pipe' });
  const output = new TextDecoder().decode(proc.stdout);

  const pids = new Set<string>();

  for (const line of output.split('\n')) {
    // Match lines like: TCP  0.0.0.0:3000  ...  LISTENING  1234
    if (line.includes(`:${port} `) || line.includes(`:${port}\t`)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid);
      }
    }
  }

  if (pids.size === 0) {
    console.log(`  Port ${port} is free.`);
    return;
  }

  for (const pid of pids) {
    const result = Bun.spawnSync(['taskkill', '/PID', pid, '/F'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode === 0) {
      console.log(`  Killed PID ${pid} (was holding port ${port}).`);
    } else {
      // Process may have already exited — not an error
      console.log(`  PID ${pid} no longer exists (port ${port}).`);
    }
  }
}

async function killPortUnix(port: number): Promise<void> {
  const proc = Bun.spawnSync(['lsof', '-ti', `:${port}`], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const rawPids = new TextDecoder().decode(proc.stdout).trim();
  if (!rawPids) {
    console.log(`  Port ${port} is free.`);
    return;
  }

  for (const pid of rawPids.split('\n').filter(Boolean)) {
    Bun.spawnSync(['kill', '-9', pid]);
    console.log(`  Killed PID ${pid} (was holding port ${port}).`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Freeing dev ports...');
for (const port of DEV_PORTS) {
  await killPort(port);
}
console.log('All ports free. Starting dev servers.\n');
