package com.twokb.micdrop.dto.stats;

import java.util.List;

public record PublicStatResponseDTO(List<ContestantGlobalStatDTO> contestants,
		// Helps the frontend build the table columns dynamically
		List<Integer> availableRounds) {
}
