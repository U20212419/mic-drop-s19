package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record ContestantRoundDetailDTO(Integer idRound, Integer roundNumber, Integer groupNumber,
		Boolean submissionsOpen, List<JudgeDetailDTO> judges) {
}
