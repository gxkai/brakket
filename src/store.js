import Vue from "vue"
import Vuex from "vuex"
import localforage from "localforage"
import shortid from "shortid"

import { generateSeedFromIdentifiers } from "./utils"
import router from "./router"

Vue.use(Vuex)

export const actionTypes = {
  GENERATE_NEW_BRACKET: "GENERATE_NEW_BRACKET",
  LOAD_BRACKET_BY_KEY: "LOAD_BRACKET_BY_URL",
}

export const mutationTypes = {
  INITIALIZE_BRACKET_STATE: "INITIALIZE_BRACKET_STATE",
}

export default new Vuex.Store({
  state: {
    participants: [],
    seed: [],
  },
  mutations: {
    [mutationTypes.INITIALIZE_BRACKET_STATE](state, newState) {
      this.state.participants = newState.participants
      this.state.seed = newState.seed
    },
  },
  actions: {
    [actionTypes.GENERATE_NEW_BRACKET]({ commit }, participants) {
      const state = {
        participants,
        seed: generateSeedFromIdentifiers(
          participants.map(participant => participant.id)
        ),
      }

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
