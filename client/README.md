# XpertRule MBed Client Example

## Install yotta

http://yottadocs.mbed.com/#installing


## Build embed client
https://github.com/lws-team/mbed-client-examples#mbed-build-instructions

### Set yotta target
1. Navigate to client-examples in cmd and run, yotta target frdm-k64f-gcc.

### Set up certificates
1. Go to mbed Device Connector website (https://connector.mbed.com/).
2. Navigate to Security credentials under My devices.
3. Click GET MY DEVICE SECURITY CREDENTIALS. You will get the needed certificate information as well as the endpoint name and domain.
4. Copy the created security credentials to sources/security.h.

### Build and run
1. In cmd run, yt build.
2. Connect your developer board to the the computer.
3. Copy \build\frdm-k64f-gcc\source\xpertrule-client.bin to the developer board, this will install and restart the device.
4. Tera Term is a nice terminal emulator that cann be used for debugging (https://ttssh2.osdn.jp/).

