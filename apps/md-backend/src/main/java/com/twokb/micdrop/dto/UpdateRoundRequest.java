package com.twokb.micdrop.dto;

public record UpdateRoundRequest(Integer roundNumber, Boolean active, Integer groupCount, Boolean submissionsOpen,
		String eliminationAmount, Boolean specialRound, Boolean requireReasoning, Boolean showReasoningToJudges,
		Boolean hasDropdownOptions, String dropdownOptions, Boolean allowDropdownRepeat, Integer maxSelectionsPerOption,
		Boolean splitScore, Integer maxSongScore, Integer maxReasoningScore) {
}
