package com.twokb.micdrop.dto.myRounds;

import java.util.List;

public record JudgeRoundDetailDTO(Integer idRound, Integer roundNumber, Integer groupNumber, Boolean submissionsOpen,
		Boolean specialRound, Boolean givingBonus, List<SubmissionJudgeDTO> submissions) {
}
