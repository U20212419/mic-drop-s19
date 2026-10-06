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

# Run stage
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Expose port 8080 (Azure App Service routes traffic to this port by default)
EXPOSE 8080

# Run the Spring Boot application (using sh -c to evaluate environment variables)
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]