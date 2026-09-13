// Copyright (c) 2022 8th Wall, Inc.
//
// app.js is the main entry point for your 8th Wall app. Code here will execute after head.html
// is loaded, and before body.html is loaded.

import './index.css'

// Register custom A-Frame components in app.js before the scene in body.html has loaded.
import {tapPlaceComponent} from './tap-place'
AFRAME.registerComponent('tap-place', tapPlaceComponent)

const bindLoadingOverlay = () => {
  const scene = document.querySelector('a-scene')
  const loadingOverlay = document.getElementById('cameraLoadingOverlay')

  if (!scene || !loadingOverlay) {
    return
  }

  scene.addEventListener('realityready', () => {
    loadingOverlay.hidden = true
  }, {once: true})
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindLoadingOverlay, {once: true})
} else {
  bindLoadingOverlay()
}
