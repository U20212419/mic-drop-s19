# Build stage
FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /app

# Copy Maven wrapper files and pom.xml
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Grant execution rights to the wrapper (crucial for Linux environments)
RUN chmod +x ./mvnw

# Download dependencies offline to cache them
RUN ./mvnw dependency:go-offline -B

# Copy the source code and build the application
COPY src ./src
RUN ./mvnw clean package -DskipTests

# Extract the layers from the built jar
RUN java -Djarmode=layertools -jar target/*.jar extract --destination target/extracted

# Run stage
FROM eclipse-temurin:25-jre
WORKDIR /app

# Create user without root privileges
RUN groupadd -r spring && useradd -r -g spring spring

# Create required directories for Application Insights and assign ownership to the spring user
RUN mkdir -p /var/log/applicationinsights && chown -R spring:spring /var/log/applicationinsights

USER spring:spring

# Copy the cached layers
COPY --from=build --chown=spring:spring /app/target/extracted/dependencies/ ./
COPY --from=build --chown=spring:spring /app/target/extracted/spring-boot-loader/ ./
COPY --from=build --chown=spring:spring /app/target/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=spring:spring /app/target/extracted/application/ ./

# Expose port 8080 (Azure App Service routes traffic to this port by default)
EXPOSE 8080

# Run the Spring Boot application (using sh -c to evaluate environment variables)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]