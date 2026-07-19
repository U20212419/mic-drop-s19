package com.twokb.micdrop.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import com.twokb.micdrop.dto.myRounds.SubmitLinkRequest;
import com.twokb.micdrop.model.CollectionItem;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.repository.CollectionItemRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CollectionItemService {

	private final CollectionItemRepository collectionItemRepository;

	@Transactional
	public void deductFromCollection(DiscordUser contestant, List<SubmitLinkRequest> submissions) {
		Map<String, Long> submittedCounts = submissions.stream()
			.collect(Collectors.groupingBy(SubmitLinkRequest::subLink, Collectors.counting()));

		for (Map.Entry<String, Long> entry : submittedCounts.entrySet()) {
			CollectionItem item = collectionItemRepository
				.findByContestantIdUserAndSubLink(contestant.getIdUser(), entry.getKey())
				.orElseThrow(() -> new IllegalArgumentException("Song not found in collection."));

			if (item.getQuantity() < entry.getValue()) {
				throw new IllegalArgumentException("Not enough copies in collection for song: " + entry.getKey());
			}
			item.setQuantity((int) (item.getQuantity() - entry.getValue()));
		}
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, List<SubmitLinkRequest> submissions, int judgeAmount) {
		long collectionAdditions = submissions.stream().filter(s -> Boolean.TRUE.equals(s.addToCollection())).count();

		if (judgeAmount > 3 && collectionAdditions != 3) {
			throw new IllegalArgumentException("You must select exactly 3 songs to add to your collection.");
		}

		for (SubmitLinkRequest slr : submissions) {
			boolean shouldAdd = judgeAmount <= 3 || Boolean.TRUE.equals(slr.addToCollection());

			if (shouldAdd && slr.subLink() != null && !slr.subLink().isBlank()) {
				CollectionItem item = collectionItemRepository
					.findByContestantIdUserAndSubLink(contestant.getIdUser(), slr.subLink())
					.orElseGet(() -> {
						CollectionItem newItem = new CollectionItem();
						newItem.setContestant(contestant);
						// Unescape the HTML entities back to normal URL characters before saving
						String rawLink = HtmlUtils.htmlUnescape(slr.subLink());
						newItem.setSubLink(rawLink);
						// Leave title/artist blank until staff add them
						return newItem;
					});
				item.setQuantity(item.getQuantity() + 1);
				collectionItemRepository.save(item);
			}
		}
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, String subLink) {
		CollectionItem item = collectionItemRepository.findByContestantIdUserAndSubLink(contestant.getIdUser(), subLink)
			.orElseGet(() -> {
				CollectionItem newItem = new CollectionItem();
				newItem.setContestant(contestant);
				// Unescape the HTML entities back to normal URL characters before saving
				String rawLink = HtmlUtils.htmlUnescape(subLink);
				newItem.setSubLink(rawLink);
				// Leave title/artist blank until staff add them
				return newItem;
			});

		item.setQuantity(item.getQuantity() + 1);
		collectionItemRepository.save(item);
	}

	@Transactional(readOnly = true)
	public List<CollectionItem> getCollectionForUser(DiscordUser contestant) {
		return collectionItemRepository.findByContestantIdUser(contestant.getIdUser());
	}

}
