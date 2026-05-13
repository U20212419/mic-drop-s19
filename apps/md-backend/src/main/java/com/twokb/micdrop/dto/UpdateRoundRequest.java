package com.twokb.micdrop.dto;

public record UpdateRoundRequest(Integer roundNumber, Boolean active, Integer groupCount, Boolean submissionsOpen,
		Integer eliminationAmount) {
}
