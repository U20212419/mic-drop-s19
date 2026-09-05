package com.twokb.micdrop.dto.myRounds;

public record DownloadSlidesRequest(Integer groupNumber) {
	public DownloadSlidesRequest {
		if (groupNumber == null) {
			groupNumber = 1;
		}
	}
}
