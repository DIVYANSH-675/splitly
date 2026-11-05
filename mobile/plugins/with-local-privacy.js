const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Local child ledgers and parent-control records must not be copied by Android
// cloud backup or device transfer. Online accounts recover through Google login.
module.exports = function withLocalPrivacy(config) {
  config = withAndroidManifest(config, value => {
    const app = value.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:fullBackupContent'] = '@xml/splitbill_backup_rules';
    app['android:dataExtractionRules'] = '@xml/splitbill_data_extraction_rules';
    return value;
  });
  return withDangerousMod(config, ['android', async value => {
    const dir = path.join(value.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(dir, { recursive: true });
    const exclusions = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'].map(domain => `<exclude domain="${domain}" path="."/>`).join('');
    await fs.writeFile(path.join(dir, 'splitbill_backup_rules.xml'), `<?xml version="1.0" encoding="utf-8"?><full-backup-content>${exclusions}</full-backup-content>`);
    await fs.writeFile(path.join(dir, 'splitbill_data_extraction_rules.xml'), `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${exclusions}</cloud-backup><device-transfer>${exclusions}</device-transfer></data-extraction-rules>`);
    return value;
  }]);
};
