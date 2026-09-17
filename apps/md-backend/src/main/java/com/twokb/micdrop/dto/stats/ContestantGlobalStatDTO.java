package com.twokb.micdrop.dto.stats;

import java.util.Map;

public record ContestantGlobalStatDTO(Integer idUser, String username, String avatar, String discordId,
		String currentStatus, // ACTIVE, ELIMINATED, DID_NOT_SUBMIT
		Integer roundsPlayed, Double globalAverage, Double globalStdDev, Double globalMedian,
		Map<Integer, RoundPerformanceDTO> rounds) {
}
