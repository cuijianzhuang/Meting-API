import tencent from "./tencent/index.js"
import netease from './netease/index.js'
import qishui from './qishui/index.js'

class Providers {

    constructor() {
        this.providers = {}

        tencent.register(this)
        netease.register(this)
        qishui.register(this)

    }

    register(provider_name, handle_obj) {
        this.providers[provider_name] = handle_obj
    }

    get(provider_name) {
        return this.providers[provider_name];
    }

    get_provider_list() {
        return Object.keys(this.providers)
    }
}

export default Providers
