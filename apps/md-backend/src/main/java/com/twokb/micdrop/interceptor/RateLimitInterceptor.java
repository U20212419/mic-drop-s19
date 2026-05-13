package com.twokb.micdrop.interceptor;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

	// In-memory cache for buckets, keyed by IP address
	private final Map<String, Bucket> cache = new ConcurrentHashMap<>();

	private Bucket createNewBucket() {
		// Limit: 60 requests per minute
		// Refill strategy: Refill 60 tokens every minute
		Bandwidth limit = Bandwidth.builder().capacity(60).refillGreedy(60, Duration.ofMinutes(1)).build();

		return Bucket.builder().addLimit(limit).build();
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws Exception {
		String ip = request.getRemoteAddr();
		Bucket bucket = cache.computeIfAbsent(ip, k -> createNewBucket());

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

}
