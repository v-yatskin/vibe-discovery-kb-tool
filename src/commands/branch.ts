import chalk from 'chalk';
import { execSync } from 'child_process';
import { getVaultPath } from '../config';
import { isGitRepo } from '../vault/git';
import {
  readSession,
  writeSession,
  clearSession,
  buildPRBody,
  Session,
} from '../vault/session';

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 40);
}

function ghAvailable(vaultPath: string): boolean {
  try {
    run('gh auth status', vaultPath);
    return true;
  } catch {
    return false;
  }
}

export async function branchCommand(options: {
  open?: string;
  close?: boolean;
  status?: boolean;
}) {
  const vaultPath = getVaultPath();

  if (!isGitRepo(vaultPath)) {
    console.error(chalk.red('\nNot a git repository. Run: git init\n'));
    process.exit(1);
  }

  // ── STATUS ──────────────────────────────────────────────────────────────────
  if (options.status || (!options.open && !options.close)) {
    const session = readSession(vaultPath);
    if (!session) {
      console.log(chalk.dim('\nNo active session branch.\n'));
    } else {
      console.log(chalk.bold(`\nActive session: ${chalk.cyan(session.branch)}`));
      if (session.pr_number > 0) {
        console.log(`  PR #${session.pr_number}  ${chalk.dim(session.pr_url)}`);
      }
      console.log(chalk.dim(`  Opened: ${session.opened_at.substring(0, 16).replace('T', ' ')}`));
      if (session.artifacts.length > 0) {
        console.log(chalk.dim(`\n  Artifacts (${session.artifacts.length}):`));
        session.artifacts.forEach((a) => console.log(chalk.dim(`    · ${a}`)));
      } else {
        console.log(chalk.dim('\n  No artifacts committed yet.'));
      }
      console.log();
    }
    return;
  }

  // ── OPEN ────────────────────────────────────────────────────────────────────
  if (options.open) {
    const existing = readSession(vaultPath);
    if (existing) {
      console.log(
        chalk.yellow(`\n⚠  Already on session branch: ${existing.branch}`)
      );
      if (existing.pr_number > 0)
        console.log(chalk.yellow(`   PR #${existing.pr_number} is open`));
      console.log(chalk.dim('   Close it first: kb branch --close\n'));
      process.exit(1);
    }

    const topic = toSlug(options.open);
    const today = new Date().toISOString().substring(0, 10);
    const branch = `kb/${today}-${topic}`;

    // Create and switch to branch
    try {
      run(`git checkout -b ${branch}`, vaultPath);
      console.log(chalk.green(`\n✓ Branch: ${branch}`));
    } catch (e: any) {
      console.error(
        chalk.red(`\nFailed to create branch "${branch}": ${e.message?.split('\n')[0]}\n`)
      );
      process.exit(1);
    }

    // Get author
    let author = '';
    try {
      author = run('git config user.name', vaultPath);
    } catch {}

    // Local branch only — no push, no PR yet.
    // Everything remote happens in --close.
    const session: Session = {
      branch,
      pr_number: 0,
      pr_url: '',
      topic,
      opened_at: new Date().toISOString(),
      author,
      artifacts: [],
    };

    writeSession(vaultPath, session);
    console.log(chalk.dim('\n  Session saved to .kb/session.json'));
    console.log(chalk.dim('  Artifacts accumulate as you run kb structure.'));
    console.log(chalk.dim('  When done: kb branch --close  (push + PR + merge happens then)\n'));
    return;
  }

  // ── CLOSE ───────────────────────────────────────────────────────────────────
  if (options.close) {
    const session = readSession(vaultPath);
    if (!session) {
      console.log(chalk.yellow('\nNo active session to close.\n'));
      return;
    }

    console.log(chalk.bold(`\nClosing session: ${chalk.cyan(session.branch)}`));

    if (session.artifacts.length > 0) {
      console.log(chalk.dim(`\n  ${session.artifacts.length} artifact(s):`));
      session.artifacts.forEach((a) => console.log(chalk.dim(`    · ${a}`)));
    }

    let mergedViaGh = false;

    // ── 1. Push branch to remote (creating it there for the first time) ────────
    try {
      run(`git push -u origin ${session.branch}`, vaultPath);
      console.log(chalk.green(`\n✓ Pushed: origin/${session.branch}`));
    } catch (e: any) {
      console.log(chalk.yellow(`\n  ⚠ Push failed: ${e.message?.split('\n')[0]}`));
      console.log(chalk.dim('  Falling back to local squash-merge...'));
    }

    // ── 2. Create PR and squash-merge via gh ──────────────────────────────────
    if (ghAvailable(vaultPath)) {
      const body = buildPRBody(session);

      let prNumber = 0;
      let prUrl = '';

      // Create PR
      try {
        const result = run(
          `gh pr create --title "feat: ${session.topic}" --body ${JSON.stringify(body)}`,
          vaultPath
        );
        const match = result.match(/\/pull\/(\d+)/);
        if (match) prNumber = parseInt(match[1]);
        prUrl = result.trim();
        console.log(chalk.green(`✓ PR created: ${prUrl}`));
      } catch (e: any) {
        console.log(chalk.yellow(`  ⚠ gh pr create failed: ${e.message?.split('\n')[0]}`));
        console.log(chalk.dim('  Create the PR manually on GitHub, then merge it.'));
      }

      // Squash-merge PR
      if (prNumber > 0) {
        try {
          run(`gh pr merge ${prNumber} --squash --delete-branch --yes`, vaultPath);
          console.log(chalk.green(`✓ PR #${prNumber} squash-merged`));
          mergedViaGh = true;
        } catch (e: any) {
          console.log(chalk.yellow(`  ⚠ gh merge failed: ${e.message?.split('\n')[0]}`));
          console.log(chalk.dim('  Falling back to local squash-merge...'));
        }
      }
    } else {
      console.log(chalk.dim('  (gh not authenticated — falling back to local squash-merge)'));
    }

    // ── 3. Local squash-merge fallback (no gh, or gh merge failed) ────────────
    if (!mergedViaGh) {
      try {
        run('git checkout main', vaultPath);
        run(`git merge --squash ${session.branch}`, vaultPath);
        const commitMsg = `feat: ${session.topic} (${session.artifacts.length} artifact${session.artifacts.length !== 1 ? 's' : ''})`;
        run(`git commit -m ${JSON.stringify(commitMsg)}`, vaultPath);
        run(`git branch -D ${session.branch}`, vaultPath);
        console.log(chalk.green(`\n✓ Squash-merged locally: "${commitMsg}"`));
        console.log(chalk.dim(`  Branch ${session.branch} deleted`));
      } catch (e: any) {
        console.log(chalk.yellow(`  ⚠ Local merge failed: ${e.message?.split('\n')[0]}`));
        console.log(chalk.dim(`  Manual: git checkout main && git merge --squash ${session.branch}`));
      }
    }

    // ── 4. Return to main, pull latest ────────────────────────────────────────
    try {
      run('git checkout main', vaultPath);
      run('git pull', vaultPath);
      console.log(chalk.green('✓ Back on main, pulled latest'));
    } catch {
      try { run('git checkout main', vaultPath); } catch {}
      console.log(chalk.dim('  (no remote — skipping pull)'));
    }

    clearSession(vaultPath);
    console.log(chalk.dim('\n  Session cleared.\n'));
  }
}
