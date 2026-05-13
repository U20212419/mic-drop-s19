package com.twokb.micdrop.dto.myRounds;

public record MyRoundDTO(Integer idRound, Integer roundNumber, Boolean active, Boolean submissionsOpen, String role,
		Integer groupNumber) {
}
