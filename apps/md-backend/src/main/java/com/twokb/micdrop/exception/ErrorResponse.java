package com.twokb.micdrop.exception;

import java.time.Instant;

public record ErrorResponse(Instant timestamp, // UTC time of the error
		int status, // HTTP status code
		String message, // Error message describing what went wrong
		String traceId // Unique identifier for backend log tracing
) {
}
