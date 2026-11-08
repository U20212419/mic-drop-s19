package com.twokb.micdrop.dto.myRounds;

import java.util.List;
import java.util.Map;

public record ContestantRoundDetailDTO(Integer idRound, Integer roundNumber, Integer groupNumber,
		Boolean submissionsOpen, Boolean specialRound, Boolean requireReasoning, List<JudgeDetailDTO> judges,
		Boolean hasDropdownOptions, List<String> dropdownOptions, Boolean allowDropdownRepeat,
		Integer maxSelectionsPerOption, Map<String, Long> optionUsageCounts) {
}
