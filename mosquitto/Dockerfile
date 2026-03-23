FROM eclipse-mosquitto:2

# Copy production config
COPY mosquitto.prod.conf /mosquitto/config/mosquitto.conf

# Create data directory
RUN mkdir -p /mosquitto/data

# 1883 = internal MQTT (server), 9001 = WebSocket (devices via ACA HTTP ingress)
EXPOSE 1883 9001
