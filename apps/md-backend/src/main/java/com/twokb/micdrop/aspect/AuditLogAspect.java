package com.twokb.micdrop.aspect;

import java.security.Principal;
import java.util.Arrays;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.twokb.micdrop.dto.UserVerifyRequest;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

@Aspect
@Component
@Slf4j
public class AuditLogAspect {

	@Before("@within(org.springframework.web.bind.annotation.RestController)")
	public void auditRequest(JoinPoint joinPoint) {
		HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes())
			.getRequest();

		String method = request.getMethod();
		String uri = request.getRequestURI();
		String discordId = "ANONYMOUS";

		// Attempt to get the authenticated user's Discord ID from the security context
		Principal principal = request.getUserPrincipal();
		if (principal != null) {
			discordId = principal.getName();
		}
		else {
			// If no authenticated user, try to get it from the arguments (for the
			// login/verify flow)
			Object[] args = joinPoint.getArgs();
			for (Object arg : args) {
				if (arg instanceof UserVerifyRequest verifyReq) {
					discordId = verifyReq.discordId();
					break;
				}
			}
		}

		// Get parameters
		String params = Arrays.toString(joinPoint.getArgs());

		// Log the audit information
		log.info("ENDPOINT: {} {}, DISCORD_ID: {}, PARAMS: {}", method, uri, discordId, params);
	}

}
