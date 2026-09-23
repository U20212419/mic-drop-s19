package com.twokb.micdrop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.repository.UserRoundRepository;

@ExtendWith(MockitoExtension.class)
class UserRoundServiceTests {

	@Mock
	private UserRoundRepository userRoundRepository;

	@Mock
	private DiscordUserService discordUserService;

	@Mock
	private RoundService roundService;

	@InjectMocks
	private UserRoundService userRoundService;

	@Test
	void randomlyAssignContestantsDistributesAllActiveUsersEvenly() {
		Round round = new Round();
		round.setIdRound(20);
		round.setRoundNumber(2);
		round.setGroupCount(3);
		round.setActive(false);

		Set<Integer> activeUserIds = Set.of(1, 2, 3, 4, 5, 6, 7);
		List<DiscordUser> activeUsers = activeUserIds.stream().map(this::userWithId).toList();

		when(roundService.getRound(20)).thenReturn(round);
		lenient().when(roundService.getRoundByNumber(2)).thenReturn(round);
		when(discordUserService.getActiveUserIds()).thenReturn(activeUserIds);
		when(discordUserService.getAllUsersById(anyList())).thenReturn(activeUsers);
		lenient().when(userRoundRepository.findByRoundIdAndRole(anyInt(), anyString())).thenReturn(List.of());
		lenient().when(userRoundRepository.findUserIdsByRound_RoundNumber(anyInt())).thenReturn(Set.of());
		lenient().when(userRoundRepository.findUsersByRoundAndRole(anyInt(), anyString())).thenReturn(List.of());
		lenient().when(userRoundRepository.findById_RoundId(anyInt())).thenReturn(List.of());

		userRoundService.randomlyAssignContestants(20);

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<UserRound>> savedAssignments = ArgumentCaptor.forClass(List.class);
		verify(userRoundRepository).saveAll(savedAssignments.capture());

		List<UserRound> assignments = savedAssignments.getValue();
		assertThat(assignments).hasSize(activeUserIds.size());
		assertThat(assignments).extracting(assignment -> assignment.getUser().getIdUser())
			.containsExactlyInAnyOrderElementsOf(activeUserIds);
		assertThat(assignments).allMatch(assignment -> assignment.getId().getRoundId().equals(20));
		assertThat(assignments).allMatch(assignment -> assignment.getUserRole() == UserRoleType.CONTESTANT);

		Map<Integer, Integer> groupSizes = new HashMap<>();
		assignments.forEach(assignment -> groupSizes.merge(assignment.getId().getGroupNumber(), 1, Integer::sum));

		assertThat(groupSizes.keySet()).containsExactlyInAnyOrder(1, 2, 3);
		assertThat(groupSizes.values()).allMatch(size -> size >= 2 && size <= 3);
	}

	private DiscordUser userWithId(Integer idUser) {
		DiscordUser user = new DiscordUser();
		user.setIdUser(idUser);
		user.setUsername("user-" + idUser);
		return user;
	}

}