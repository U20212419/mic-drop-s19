package com.twokb.micdrop.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.CollectionItem;

public interface CollectionItemRepository extends JpaRepository<CollectionItem, Integer> {

	List<CollectionItem> findByContestantIdUserAndQuantityGreaterThan(Integer idContestant, Integer quantity);

	Optional<CollectionItem> findByContestantIdUserAndSubLink(Integer idContestant, String subLink);

	List<CollectionItem> findByContestantIdUser(Integer idContestant);

}
