
const host_name_mqtt = process.env.MQTT_HOST;
const api_url = process.env.API_URL;
const mqtt_topic = process.env.MQTT_TOPIC || 'device/state';
const mqtt_user_name = process.env.MQTT_USER_NAME;
const mqtt_password = process.env.MQTT_PASSWORD;
const mqtt_publish_topic = process.env.MQTT_PUBLISH_TOPIC || 'device/updated';
const mqtt_client_id = process.env.MQTT_CLIENT_ID || 'database_sync_local-client';
const mqtt_topic_discovery = process.env.MQTT_TOPIC_SMARTHOME_DISCOVERY || 'smarthome/discovery';
const host_port_mqtt = process.env.MQTT_PORT || 1883;
const mqtt_protocol = process.env.MQTT_PROTOCOL || 'mqtt';

const api_key = process.env.API_KEY || '';
const api_authorization = process.env.API_AUTHORIZATION || '';

module.exports = {
    host_name_mqtt,
    host_port_mqtt,
    mqtt_protocol,
    api_url,
    mqtt_topic,
    mqtt_user_name,
    mqtt_password,
    mqtt_publish_topic,
    mqtt_client_id,
    mqtt_topic_discovery,
    api_key,
    api_authorization,
};
