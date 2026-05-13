package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record JudgeRoundDetailDTO(Integer idRound, Integer roundNumber, Integer groupNumber, Boolean submissionsOpen,
		List<SubmissionJudgeDTO> submissions) {
}
