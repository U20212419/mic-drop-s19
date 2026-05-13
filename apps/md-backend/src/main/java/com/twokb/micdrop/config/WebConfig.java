package com.twokb.micdrop.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.twokb.micdrop.interceptor.RateLimitInterceptor;

import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

	private final RateLimitInterceptor rateLimitInterceptor;

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		// Apply to all API endpoints
		registry.addInterceptor(rateLimitInterceptor).addPathPatterns("/api/**");
	}

}
