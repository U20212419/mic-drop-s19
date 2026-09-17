package com.twokb.micdrop.dto.stats;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RoundPerformanceDTO(Integer roundNumber, Integer groupNumber, Double average, Double stdDev,
		List<BigDecimal> scores, boolean isPending, boolean isDns, Instant submittedAt, Integer groupRank) {
}
