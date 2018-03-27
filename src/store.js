import Vue from "vue"
import Vuex from "vuex"
import localforage from "localforage"
import shortid from "shortid"

import {
  generateSeedFromIdentifiers,
  generateResultStructureFromSeed,
} from "./utils"

import router from "./router"

Vue.use(Vuex)

export const actionTypes = {
  GENERATE_NEW_BRACKET: "GENERATE_NEW_BRACKET",
  LOAD_BRACKET_BY_KEY: "LOAD_BRACKET_BY_URL",
}

export const mutationTypes = {
  CHANGE_SIDE_SCORE: "CHANGE_SIDE_SCORE",
  INITIALIZE_BRACKET_STATE: "INITIALIZE_BRACKET_STATE",
}

// type Participant = { name: string, id: number }
// type Participants = Array<Participant>
// type Seed = Array<{ home: number, away: number }>
// type Side = { score: ?number }
// type Match = { home: Side, away: Side, roundIndex: number, matchIndex: number }
// type Round = Array<Match>
// type Results = Array<Round>

export default new Vuex.Store({
  state: {
    participants: [], // Participants
    seed: [], // Seed
    results: [], // Results
  },
  mutations: {
    [mutationTypes.CHANGE_SIDE_SCORE](state, payload) {
      const { roundIndex, matchIndex, side, score } = payload

      state.results[roundIndex][matchIndex][side].score = score
    },
    [mutationTypes.INITIALIZE_BRACKET_STATE](state, payload) {
      const { participants, results, seed } = payload

      state.participants = participants
      state.results = results
      state.seed = seed
    },
  },
  actions: {
    [actionTypes.GENERATE_NEW_BRACKET]({ commit }, participants) {
      const seed = generateSeedFromIdentifiers(
        participants.map(participant => participant.id)
      )

      const results = generateResultStructureFromSeed(seed)
      const state = { participants, results, seed }

      commit(mutationTypes.INITIALIZE_BRACKET_STATE, state)

      const bracketId = shortid.generate()

      localforage
        .setItem(bracketId, JSON.stringify(state))
        .then(() => router.push(`/bracket/${bracketId}`))
    },
    [actionTypes.LOAD_BRACKET_BY_KEY]({ commit }, key) {
      localforage.getItem(key).then(value => {
        const state = JSON.parse(value)
        commit(mutationTypes.INITIALIZE_BRACKET_STATE, state)
      })
    },
  },
})
