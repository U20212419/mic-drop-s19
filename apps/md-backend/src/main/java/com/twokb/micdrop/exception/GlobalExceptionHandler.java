package com.twokb.micdrop.exception;

import java.time.Instant;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
		// Generate a 8-character trace ID for correlating logs
		String traceId = UUID.randomUUID().toString().substring(0, 8);

		// Log the exception with the trace ID for backend debugging
		log.warn("Trace ID {}: Validation Error - {}", traceId, ex.getMessage());

		ErrorResponse errorResponse = new ErrorResponse(Instant.now(), // Current UTC time
				HttpStatus.BAD_REQUEST.value(), // HTTP status code
				ex.getMessage(), // Exception message
				traceId // Trace ID for backend log correlation
		);

		return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleGeneralException(Exception ex) {
		// Generate a 8-character trace ID for correlating logs
		String traceId = UUID.randomUUID().toString().substring(0, 8);

		// Log the exception with the trace ID for backend debugging
		log.error("Trace ID {}: Unexpected Error - {}", traceId, ex.getMessage(), ex);

		ErrorResponse errorResponse = new ErrorResponse(Instant.now(), // Current UTC time
				HttpStatus.INTERNAL_SERVER_ERROR.value(), // HTTP status code
				"An unexpected error occurred.", // Generic message for clients
				traceId // Trace ID for backend log correlation
		);

		return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
	}

}
