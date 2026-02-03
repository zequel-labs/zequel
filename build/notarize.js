const { execSync } = require('child_process');
const path = require('path');

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_TIME_MS = 30 * 60 * 1000;

const log = (message) => {
  console.log(`  [notarize] ${message}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runCommand = (command) => {
  return execSync(command, { encoding: 'utf-8' }).trim();
};

const parseSubmissionId = (output) => {
  const match = output.match(/id:\s*([0-9a-f-]+)/i);
  if (!match) {
    throw new Error(`Could not parse submission ID from output:\n${output}`);
  }
  return match[1];
};

const parseStatus = (output) => {
  const match = output.match(/status:\s*(\S+)/i);
  return match ? match[1] : 'Unknown';
};

const notarize = async (context) => {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    log('Skipping notarization — not macOS');
    return;
  }

  const apiKey = process.env.APPLE_API_KEY;
  const apiKeyId = process.env.APPLE_API_KEY_ID;
  const apiIssuer = process.env.APPLE_API_ISSUER;

  if (!apiKey || !apiKeyId || !apiIssuer) {
    log('Skipping notarization — missing APPLE_API_KEY, APPLE_API_KEY_ID, or APPLE_API_ISSUER');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  log(`Submitting ${appPath} for notarization...`);

  const submitOutput = runCommand(
    `xcrun notarytool submit "${appPath}" --key "${apiKey}" --key-id "${apiKeyId}" --issuer "${apiIssuer}" --output-format json`
  );

  let submissionId;
  try {
    const json = JSON.parse(submitOutput);
    submissionId = json.id;
  } catch {
    submissionId = parseSubmissionId(submitOutput);
  }

  if (!submissionId) {
    throw new Error(`Failed to get submission ID from notarytool output:\n${submitOutput}`);
  }

  log(`Submission ID: ${submissionId}`);
  log(`Polling for notarization status (every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_POLL_TIME_MS / 60_000}min)...`);

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await sleep(POLL_INTERVAL_MS);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    let infoOutput;

    try {
      infoOutput = runCommand(
        `xcrun notarytool info "${submissionId}" --key "${apiKey}" --key-id "${apiKeyId}" --issuer "${apiIssuer}" --output-format json`
      );
    } catch (err) {
      log(`[${elapsed}s] Failed to check status (will retry): ${err.message}`);
      continue;
    }

    let status;
    try {
      const json = JSON.parse(infoOutput);
      status = json.status;
    } catch {
      status = parseStatus(infoOutput);
    }

    log(`[${elapsed}s] Status: ${status}`);

    if (status === 'Accepted') {
      log('Notarization accepted. Stapling...');
      try {
        runCommand(`xcrun stapler staple "${appPath}"`);
        log('Stapling complete.');
      } catch (err) {
        log(`WARNING: Stapling failed: ${err.message}`);
        log('The app is still notarized — macOS will verify online via Gatekeeper.');
      }
      return;
    }

    if (status === 'Invalid' || status === 'Rejected') {
      log('Fetching notarization log for details...');
      try {
        const logOutput = runCommand(
          `xcrun notarytool log "${submissionId}" --key "${apiKey}" --key-id "${apiKeyId}" --issuer "${apiIssuer}"`
        );
        log(`Notarization log:\n${logOutput}`);
      } catch {
        log('Could not fetch notarization log.');
      }
      throw new Error(`Notarization failed with status: ${status}`);
    }
  }

  const totalMinutes = Math.round((Date.now() - startTime) / 60_000);
  log(`WARNING: Notarization polling timed out after ${totalMinutes} minutes.`);
  log('The app was submitted for notarization and may still be accepted.');
  log('macOS Gatekeeper will verify the notarization status online.');
};

module.exports = notarize;
