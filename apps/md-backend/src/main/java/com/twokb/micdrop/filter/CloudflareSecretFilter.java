package com.twokb.micdrop.filter;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class CloudflareSecretFilter extends OncePerRequestFilter {

	@Value("${cloudflare.secret-token}")
	private String cloudflareSecretToken;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {

		// Allow preflight requests (OPTIONS) to pass through without checking the secret
		if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
			filterChain.doFilter(request, response);
			return;
		}

		// When working in a local development environment, bypass the secret check for
		// convenience
		if (cloudflareSecretToken == null || cloudflareSecretToken.isBlank()
				|| "DISABLED".equalsIgnoreCase(cloudflareSecretToken)) {
			filterChain.doFilter(request, response);
			return;
		}

		String requestSecret = request.getHeader("X-Cloudflare-Secret");

		// Validate the secret token from the request header against the configured secret
		if (cloudflareSecretToken == null || !cloudflareSecretToken.equals(requestSecret)) {
			response.setStatus(HttpStatus.FORBIDDEN.value());
			response.setContentType("application/json");
			response.getWriter().write("{\"error\": \"Forbidden: Direct access is not allowed.\"}");
			return;
		}

		// If the secret is valid, continue with the filter chain
		filterChain.doFilter(request, response);
	}

}
