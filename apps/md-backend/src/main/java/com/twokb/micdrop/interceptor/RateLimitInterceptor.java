package com.twokb.micdrop.interceptor;

import java.time.Duration;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

	// In-memory cache for buckets, keyed by IP address
	// Maximum size of 1000 entries, with entries expiring 5 minutes after last access
	private final Cache<String, Bucket> cache = Caffeine.newBuilder()
		.maximumSize(1000)
		.expireAfterAccess(Duration.ofMinutes(5))
		.build();

	private Bucket createNewBucket() {
		// Limit: 100 requests per minute
		// Refill strategy: Refill 60 tokens every minute
		Bandwidth limit = Bandwidth.builder().capacity(100).refillGreedy(60, Duration.ofMinutes(1)).build();

		return Bucket.builder().addLimit(limit).build();
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws Exception {
		// Ignore preflight requests (OPTIONS) for CORS
		if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
			return true;
		}

		String cacheKey;
		if (request.getUserPrincipal() != null) {
			// Use username as cache key for authenticated users
			cacheKey = "USER:" + request.getUserPrincipal().getName();
		}
		else {
			// Use IP address as cache key for unauthenticated users
			cacheKey = "IP:" + getClientIpAddress(request);
		}

		Bucket bucket = cache.get(cacheKey, k -> createNewBucket());

		if (bucket.tryConsume(1)) {
			return true; // Allow the request to proceed
		}
		else {
			response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
			response.setContentType("application/json");
			response.getWriter().write("{\"message\": \"Too many requests - please try again later.\"}");
			return false; // Block the request
		}
	}

	private String getClientIpAddress(HttpServletRequest request) {
		String xForwardedForHeader = request.getHeader("X-Forwarded-For");
		if (xForwardedForHeader == null || xForwardedForHeader.isEmpty()
				|| "unknown".equalsIgnoreCase(xForwardedForHeader)) {
			return request.getRemoteAddr();
		}
		// In case of multiple IPs, take the first one (client)
		return xForwardedForHeader.split(",")[0].trim();
	}

}
