
function getPlatformFromDeviceId(device_id) {
    if (device_id.includes('esp32')) {
        return 'ESP32';
    }
    if (device_id.includes('esp8266')) {
        return 'ESP8266';
    }
    if (device_id.includes('raspberry')) {
        return 'Raspberry';
    }
    if (device_id.includes('arduino')) {
        return 'Arduino';
    }
    return '';
}

module.exports = {
    getPlatformFromDeviceId
};