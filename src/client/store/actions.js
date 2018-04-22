import localforage from "localforage"
import shortid from "shortid"
import * as R from "ramda"

import { mutationTypes } from "./mutations"
import initialState from "./model"
import router from "../router"
import {
  generateSeedFromIdentifiers,
  generateResultStructureFromSeed,
  ensureTournamentDomainValidity,
} from "../domain"

export const actionTypes = {
  ENSURE_TOURNAMENT_STATE_VALIDITY: "ENSURE_TOURNAMENT_STATE_VALIDITY",
  GENERATE_NEW_TOURNAMENT: "GENERATE_NEW_TOURNAMENT",
  LOAD_TOURNAMENT_BY_TOKEN: "LOAD_TOURNAMENT_BY_TOKEN",
  SHUFFLE: "SHUFFLE",
  SOCKET_RECONNECT: "socket_reconnect",
  SOCKET_REQUEST_TOURNAMENT_STATE: "socket_requestTournamentState",
  SOCKET_TOURNAMENT_DOES_NOT_EXIST: "socket_tournamentDoesNotExist",
  SOCKET_TOURNAMENT_SCORE: "socket_tournamentScore",
  SOCKET_TOURNAMENT_STATE: "socket_tournamentState",
  STORE_TOURNAMENT_STATE_LOCALLY: "STORE_TOURNAMENT_STATE_LOCALLY",
  STORE_TOURNAMENT_STATE_REMOTELY: "STORE_TOURNAMENT_STATE_REMOTELY",
  UPDATE_TOURNAMENT_SCORE: "UPDATE_TOURNAMENT_SCORE",
}

export const actions = {
  [actionTypes.ENSURE_TOURNAMENT_STATE_VALIDITY](context) {
    const { commit, dispatch, state } = context

    commit(
      mutationTypes.INITIALIZE_TOURNAMENT_STATE,
      R.evolve({ domain: ensureTournamentDomainValidity }, state.tournament)
    )

    dispatch(actionTypes.STORE_TOURNAMENT_STATE_LOCALLY)
  },
  async [actionTypes.GENERATE_NEW_TOURNAMENT](store, participants) {
    const { commit, dispatch, state } = store
    const seed = generateSeedFromIdentifiers(Object.keys(participants))
    const results = generateResultStructureFromSeed(seed)

    const token = shortid.generate()

    const tournament = {
      domain: {
        name: state.tournament.domain.name,
        participants,
        results,
        seed,
      },
      local: {
        created: +new Date(),
        lastModified: +new Date(),
      },
      token,
    }

    commit(mutationTypes.INITIALIZE_TOURNAMENT_STATE, tournament)
    await dispatch(actionTypes.STORE_TOURNAMENT_STATE_LOCALLY)

    // this relies on the fact that the TournamentBracketView dispatches
    // LOAD_TOURNAMENT_BY_TOKEN action, which emits 'tournamentLoaded', the server
    // responds with 'tournamentDoesNotExist' and we respond with 'doCreateTournament'
    router.push({
      name: "tournament-bracket",
      params: { token },
    })
  },
  async [actionTypes.LOAD_TOURNAMENT_BY_TOKEN]({ commit, state }, token) {
    commit(mutationTypes.SET_TOURNAMENT_LOADING, true)
    const value = await localforage.getItem(token)

    if (value) {
      const tournamentState = JSON.parse(value)
      commit(mutationTypes.INITIALIZE_TOURNAMENT_STATE, tournamentState)

      state.$socket.emit(
        "tournamentLoaded",
        tournamentState.token,
        tournamentState.local.lastModified
      )
    } else if (state.online) {
      state.$socket.emit("requestTournamentState", token)
      commit(mutationTypes.SET_TOURNAMENT_LOADING, true)
    } else {
      commit(mutationTypes.INITIALIZE_TOURNAMENT_STATE, initialState.tournament)
    }
  },
  [actionTypes.SHUFFLE]({ commit, dispatch, state }) {
    const seed = generateSeedFromIdentifiers(
      Object.keys(state.tournament.domain.participants)
    )

    commit(
      mutationTypes.INITIALIZE_TOURNAMENT_STATE,
      R.assocPath(["domain", "seed"], seed, state.tournament)
    )

    dispatch(actionTypes.STORE_TOURNAMENT_STATE_LOCALLY)
    dispatch(actionTypes.STORE_TOURNAMENT_STATE_REMOTELY)
  },
  [actionTypes.SOCKET_RECONNECT]({ state }) {
    if (state.tournament.local.created) {
      state.$socket.emit(
        "tournamentLoaded",
        state.tournament.token,
        state.tournament.local.lastModified
      )
    }
  },
  [actionTypes.SOCKET_REQUEST_TOURNAMENT_STATE]({ dispatch }) {
    dispatch(actionTypes.STORE_TOURNAMENT_STATE_REMOTELY)
  },
  [actionTypes.SOCKET_TOURNAMENT_DOES_NOT_EXIST]({ commit, state }) {
    if (state.tournament.local.created) {
      state.$socket.emit(
        "doCreateTournament",
        state.tournament.token,
        state.tournament.domain
      )
    } else {
      commit(mutationTypes.SET_TOURNAMENT_LOADING, false)
    }
  },
  [actionTypes.SOCKET_TOURNAMENT_SCORE]({ commit, dispatch }, payload) {
    commit(mutationTypes.SET_TOURNAMENT_SCORE, payload)
    dispatch(actionTypes.ENSURE_TOURNAMENT_STATE_VALIDITY)
  },
  [actionTypes.SOCKET_TOURNAMENT_STATE]({ commit }, payload) {
    commit(mutationTypes.INITIALIZE_TOURNAMENT_STATE, {
      ...payload,
      local: payload.remote,
      token: router.currentRoute.params.token,
    })
  },
  async [actionTypes.STORE_TOURNAMENT_STATE_LOCALLY]({ state }) {
    await localforage.setItem(
      state.tournament.token,
      JSON.stringify(R.omit(["transient", "remote"], state.tournament))
    )
  },
  [actionTypes.STORE_TOURNAMENT_STATE_REMOTELY]({ state }) {
    state.$socket.emit(
      "tournamentState",
      R.omit(["transient", "remote"], state.tournament)
    )
  },
  [actionTypes.UPDATE_TOURNAMENT_SCORE]({ commit, state }, payload) {
    state.$socket.emit("tournamentScore", state.tournament.token, payload)
    commit(mutationTypes.SET_TOURNAMENT_SCORE, payload)
    // we do not want to store the score here, because it might not be validated
    // we wait until the ENSURE_TOURNAMENT_STATE_VALIDITY action
  },
}
