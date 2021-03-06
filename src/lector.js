import { _e, _p, Pragma, util, _thread, runAsync } from "pragmajs"
import { range, wfy, isOnScreen, scrollTo, onScroll } from "./helpers/index"
import { PragmaWord, PragmaLector, PragmaMark } from "./pragmas/index"
import { LectorSettings } from "./ui/index"
import * as _ext from "./extensions/index"

import css from "./styles/styles.json"


// TODO add more default options
const default_options = {
  wfy: true,
  pragmatizeOnCreate: true,
  experimental: false,
  settings: false,
  defaultsStyles: true
}

const Mark = (lec) => {
  let mark = new PragmaMark()

  function logger(w){
  }

  // auto scroll feature
  // TODO put somewhere else
  let scrollingIntoView = false
  let usersLastScroll = 0

  function userIsScrolling(){
    return usersLastScroll - Date.now() > -10
  }

  function autoScroll(w){
    //return
    if (userIsScrolling() || isOnScreen(mark.element) || scrollingIntoView) return false
    // else we're out of view

    scrollingIntoView = true

    let cbs = [] // these will be the callbacks that are gonna run when the scroll is done
    // TODO  make a class Chain that does this.
    // Chain.add(cb), Chain.do() to execute and shit
    if (lec.isReading){
      lec.pause()
      cbs.push(() => {
        lec.read()
      })
    }

    cbs.push(()=>{
      //console.warn("suck my diiiiiiiiiick")
    })

    //console.warn("mark is out of screen")
    //console.log('lec reading:', lec.isReading)

    scrollTo(mark).then(() => {
      cbs.forEach(cb => cb())
      scrollingIntoView = false
    })
  }

  const threshold = 40 // how fast should you scroll to pause the pointer
  let lastScroll = 0
  onScroll(s => {
    usersLastScroll = !scrollingIntoView ? Date.now() : usersLastScroll
    // console.log('user is scrolling', userIsScrolling())

    if (userIsScrolling() && lec.isReading){
      let dscroll = Math.abs(lastScroll-s)
      lastScroll = s
      if (dscroll>threshold){
        // console.log('ds=', dscroll)
        // TODO prevent from calling pause to many times
        // on too fast scroll, pause mark
        lec.pause()
      }
    }
  })

  mark.on('mouseover', function(){
    console.log(this, 'hover')
  })

  mark.do(logger, autoScroll)
  return mark
}

//console.log(_e("#div").deepQueryAll.toString())
export const Word = (element, i) => {
  let w = new PragmaWord(i)
          .as(element)
          .setValue(0)

  // new Promise(_ => {
    let thisw = w.element.deepQueryAll('w')
    // console.timeLog('deepQuery')
    if (i && thisw.length === 0) {
      w.addListeners({
        "click": function(e, comp){
          this.summon()
        }
      })
    }

    thisw.forEach((el, i) => {
      let ww = Word(el, i)
      w.add(ww)
    })
    // console.log('async done')
  // })

  // console.log('w done')
  return w
}

export const Reader = (l, options=default_options) => {
  l = _e(l)
  if (options.wfy) wfy(l)
  let w = Word(l)

  let lec = new PragmaLector("lector")
              .as(l)
              .setValue(0)
              .connectTo(w)
  
  lec.mark = Mark(lec)
  if (options.settings) lec.settings = LectorSettings(lec)


  function bindKeys(){
    lec.bind("right", _ => lec.goToNext())
    lec.bind("left", _ => lec.goToPre())

    lec.bind("space", _ => false, 'keydown') // dont trigger the dumb fucken scroll thing
    lec.bind("space", function(){
      this.toggle()
      return false
    }, 'keyup')

  }

  function experiment(){
    if (globalThis.pragmaSpace.mousetrapIntegration){
        bindKeys()
    }
  }

  if (options.pragmatizeOnCreate) lec.pragmatize()
  if (options.experimental) experiment()

  return lec
}

function _needWrapper(op){
    return op.stream || op.paginate
}


function _streamer(sf){
  return _p('streamer')
          .setValue(0)
          .run(function(){
            this.fetch = sf
            this.getContent = function(){
              return this.fetch(this.value)
            }
          })

}

export const Lector = (l, options=default_options) => {
  if (!_needWrapper(options)) return Reader(l, options)

  util.log("configuration appears to be a bit more complicated")

  if (options.defaultStyles){
    util.addStyles(css.main)
  }

  if (options.fullStyles){
    util.addStyles(css.full)
  }

  if (!options.experimental) return console.log('EXPERIMENTAL FEATURES TURNED OFF')
  let lector

  if (options.stream &&
      options.paginate &&
      options.paginate.from === 'stream' &&
      options.paginate.as === 'infiniteScroll'){

    util.log('setting up streamer service')

    let streamer = _streamer(options.stream)
    let paginator = _ext.infinityPaginator(streamer, l, options.paginate.config || {})

    // let reader = _p()
    //               .as(_e(l).parentElement)

    // console.log('creating new lector')
    // console.log(l)
    // console.log(_e(l).parentElement)
    // let options = util.objDiff({ skip: true })
    lector = Reader(_e(l).parentElement, options)
                  .adopt(paginator, streamer)

    lector.paginator = paginator
    if (lector.settings){
      console.log("lector has settings! connecting paginator's value to pagecomp")
      let pageComp = lector.settings.find('!page')
      pageComp.wireTo(lector.paginator)
    }
    console.log('paginator', paginator)

    paginator.fill()
    // return lector
  }

  
  if (options.scaler){
    // let _scaler = _p().run(_ext.scaler)
    let _scaler = new _ext.Scaler(lector.element)
    
    // _scaler.setTarget(lector.element)
    
    _scaler.scaleUp()
    // _scaler.bind("mod+=", function() { _scaler.scaleUp();  return false;})
    // _scaler.bind("mod+-", function() { _scaler.scaleDown();  return false;})
    
    lector.adopt(_scaler)
    lector.scaler = _scaler

    if (lector.settings){
      console.log("lector has settings! connecting scaler's value to scalercomp")
      let scaleComp = lector.settings.find('!scale')
      if (scaleComp) scaleComp.wireTo(lector.scaler)
    }  

  }


  
  return lector
}
