package com.twokb.micdrop.config;

import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.twokb.micdrop.converter.CustomJwtConverter;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	private final CustomJwtConverter customJwtConverter;

	@Value("${jwt.secret}")
	private String jwtSecret;

	@Value("${app.cors.allowed-origins}")
	private String[] allowedOrigins;

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			// Disable CSRF to use JWT tokens for stateless authentication
			.csrf(csrf -> csrf.disable())
			// Configure CORS to allow requests from the frontend
			.cors(cors -> cors.configurationSource(corsConfigurationSource()))
			// Access rules
			.authorizeHttpRequests(auth -> auth.requestMatchers("/api/public/**")
				.permitAll() // Allow public endpoints without authentication
				.requestMatchers("/api/auth/verify")
				.permitAll() // Allow auth verify endpoint without authentication
				.anyRequest()
				.authenticated())
			// Configure as Resource Server to validate JWT tokens
			.oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(customJwtConverter)));

		return http.build();
	}

	@Bean
	public JwtDecoder jwtDecoder() {
		SecretKeySpec secretKey = new SecretKeySpec(jwtSecret.getBytes(), "HmacSHA256");
		return NimbusJwtDecoder.withSecretKey(secretKey).build();
	}

	@Bean
	public JwtEncoder jwtEncoder() {
		SecretKey key = new SecretKeySpec(jwtSecret.getBytes(), "HmacSHA256");
		JWKSource<SecurityContext> immutableSecret = new ImmutableSecret<>(key);
		return new NimbusJwtEncoder(immutableSecret);
	}

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(List.of(allowedOrigins));
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		configuration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

}
