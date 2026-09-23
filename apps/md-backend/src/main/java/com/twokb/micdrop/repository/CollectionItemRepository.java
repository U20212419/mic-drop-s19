package com.twokb.micdrop.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.twokb.micdrop.model.CollectionItem;
import com.twokb.micdrop.model.DiscordUser;

public interface CollectionItemRepository extends JpaRepository<CollectionItem, Integer> {

	List<CollectionItem> findByContestantIdUserAndSubLink(Integer idContestant, String subLink);

	List<CollectionItem> findByContestantIdUser(Integer idContestant);

	@Query("SELECT COUNT(c) FROM CollectionItem c WHERE c.contestant = :contestant AND c.subLink = :subLink")
	long countByContestantAndSubLink(@Param("contestant") DiscordUser contestant, @Param("subLink") String subLink);

}
