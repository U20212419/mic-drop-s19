package com.twokb.micdrop.dto;

public record SlideJobStatus(String status, // PROCESSING, COMPLETED, FAILED
		byte[] fileData) {
}
