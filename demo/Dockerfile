FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw && ./mvnw -B clean package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN mkdir -p /data/videos
ENV AITM_VIDEO_DIR=/data/videos
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
