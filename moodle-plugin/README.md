# Moodle Plugin: local_rps

This custom Moodle plugin provides a REST Web Service endpoint `local_rps_create_file_resource` for programmatically creating file resource activities (mod_resource) in Moodle courses.

## Installation Instructions

1. Copy the `local/rps` directory to your Moodle installation's `local/` folder:
   ```bash
   cp -r moodle-plugin/local/rps /path/to/moodle/local/
   ```

2. Log into your Moodle site as Administrator and go to:
   **Site Administration → Notifications**
   Moodle will detect the new plugin and prompt you to perform the database upgrade. Click **Upgrade Moodle database now**.

3. Add the Web Service function to your Web Service Token/Service:
   - Go to **Site Administration → Plugins → Web Services → External Services**
   - Edit your service (or the custom service linked to your token)
   - Click **Functions** → **Add functions**
   - Search for `local_rps_create_file_resource` and add it to the service.

4. Done! The internal tool can now automatically upload RPS files and create file resource activities on deployed courses.
