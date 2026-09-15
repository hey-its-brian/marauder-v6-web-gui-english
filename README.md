# marauder-v6-web-gui

Standalone English web interface for controlling an **ESP32 Marauder v6.1** over **Web Serial at 115200 baud**. Everything runs from `index.html`: no backend, no accounts, and no production dependencies.

## Features

- USB connection over Web Serial.
- Real-time terminal with incremental UTF-8 decoding.
- Command history with ↑/↓.
- Selectable LF and CRLF.
- Session log export.
- Hierarchical menu matching the one on the device.
- Separation between the **visible name** and the **command sent** when the menu label does not match the CLI.
- Forms for operations that require parameters.
- Index and range validation before sending.
- Quick command filter.
- Fixed `stopscan` button.
- Responsive interface for desktop and small screens.
- Serial output rendered as text to avoid interpreting HTML received from the device.
- Automated tests with Playwright and Chromium via GitHub Actions.

## Implemented menu

### WiFi

**Sniffers**

`sniffprobe`, `sniffbeacon`, `sniffdeauth`, `packetcount`, `sniffpmkid`, `packetmonitor`, `channelanalyzer`, `channelsummary`, `sniffraw`, `pwnagotchi`, `pineapple`

**Scanners**

`pingscan`, `arpscan`, `portscan`, `sshescan`, `telnetscan`, `smtpscan`, `dnsscan`, `httpscan`, `httpscan`, `rdpscan`

**Attacks**

`evilportal`, `deauth`, `apclonespam`, `deauthtarget`, `karma`, `badmsg`, `badmsgtarget`, `assocsleep`, `assocsleeptarget`, `saecommit`, `channelswitch`, `quiettime`

**General**

`clearstations`, `selecthtml`, `selectap`, `viewap`, `selectstation`, `join`, `joinsaved`, `startap`, `hostapinfo`, `setmac`, `shutdown`, `loadwardrive`, `generatessids`, `selectprobessids`, `addssids`, `clearssids`, `clearaps`

### Bluetooth

**Sniffers**

`sniffbt`, `sniffflipper`, `findmy`, `findmymonitor`, `skimmer`, `btanalyze`, `flock`, `metadetect`, `foxhunt`

**Attacks**

`sourapple`, `applejuice`, `swiftpair`, `samsungspam`, `googlespam`, `flipperspam`, `blespam`, `spoofairtag`, `findmysound`

### GPS

`gpsdata`, `nmea`, `tracker start`, `tracker stop`, `gpspoi`

### Device & Settings

`info`, `reboot`, `ls /`, `brightness`, `settings`

Settings like `forcepmkid` or `chanhop` can be enabled/disabled from the terminal depending on what the installed build exposes.

## Menu label vs. CLI

Some device options are menu names and not necessarily the literal string the CLI accepts. The GUI keeps both concepts separate.

Known examples for v1.16.0:

| Menu | Command sent |
| --- | --- |
| `pwnagotchi` | `sniffpwn` |
| `sshescan` | `portscan -s ssh` |
| `dnsscan` | `portscan -s dns` |
| `deauth` | `attack -t deauth` |
| `badmsg` | `attack -t badmsg` |
| `saecommit` | `attack -t sae` |
| `skimmer` | `sniffskim` |
| `flock` | `sniffbt -t flock` |
| `metadetect` | `sniffbt -t meta` |
| `sourapple` | `blespam -t sourapple` |
| `applejuice` | `blespam -t applejuice` |
| `swiftpair` | `blespam -t windows` |
| `samsungspam` | `blespam -t samsung` |
| `googlespam` | `blespam -t google` |
| `flipperspam` | `blespam -t flipper` |
| `tracker start` | `gpstracker -c start` |
| `tracker stop` | `gpstracker -c stop` |

The GUI shows, below each option, the string it will actually send. For a modified build or a fork, run `help`, `info`, and `settings` and adjust the mapping in `MENU` if needed.

## Operations with parameters

The interface opens an editor instead of sending an incomplete template for operations such as:

- `portscan`
- `karma`
- `selectap`
- `viewap`
- `selectstation`
- `join`
- `setmac`
- `findmy`
- `blespam`
- `spoofairtag`
- `findmysound`
- `brightness`

Indexes must be non-negative integers. `brightness` accepts values from `0` to `9`.

## Local use

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Then open:

```text
http://localhost:8080
```

Use desktop Chrome or Edge, connect the Marauder with a USB data cable, and click **Connect USB**.

Web Serial requires a secure context: `localhost` or HTTPS. Close Arduino Serial Monitor, esptool, PuTTY, or other applications that might have the same port open.

Port configuration:

- 115200 baud
- 8 bits
- no parity
- 1 stop bit
- no flow control

## Interface security

The application uses a restrictive CSP and does not load third-party JavaScript. Bytes received over Serial are decoded and inserted as text, not through `innerHTML`.

Options in the **Attacks** category require explicit confirmation before being sent. Use those functions only on equipment, devices, and networks you own or are authorized to test.

Passwords used with `join` may appear in the firmware response and therefore end up stored in the exported log. Review the logs before sharing them.

## Tests

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/browser.cjs
```

The suite checks:

- presence of all menu options;
- CLI aliases;
- parameter validation;
- Web Serial at 115200;
- LF and CRLF;
- UTF-8 fragmentation;
- protection against HTML received over Serial;
- disconnection and reconnection;
- menu filter;
- responsive design.

GitHub Actions runs the same test on every pull request and on pushes to `main`.

## Reference

The project uses ESP32 Marauder v1.16.0 and its CLI implementation as a reference. The hardware, the GPS/Bluetooth modules, and certain functions depend on the specific build installed on the device.

Independent project, not affiliated with the author of ESP32 Marauder.
