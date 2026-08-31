const DEBUG = true

const GUESS_FACTOR_SIZE = 31 //[-15, 15]
const MAX_VELOCITY = 8.0 //Current engine maximum velocity per tick

const DISTANCE_FROM_WALL = 135
const WALL_PADDING = 35
const LEFT_WALL = WALL_PADDING
const TOP_WALL = WALL_PADDING
const RIGHT_WALL = game.arenaWidth - WALL_PADDING
const BOTTOM_WALL = game.arenaHeight - WALL_PADDING

class WaveBullet {
  constructor(x, y, bearing, direction, speed) {
    this.x = x
    this.y = y
    this.bearing = bearing
    this.direction = direction
    this.speed = speed
    this.tick = game.tick
  }

  get maxEscapeAngle() {
    return Math.asin(MAX_VELOCITY / this.speed)
  }

  hasReached(target) {
    const radius = this.speed * (game.tick - this.tick)
    const dx = target.x - this.x
    const dy = target.y - this.y
    const distance = Math.sqrt(dx*dx + dy*dy)
    return (radius >= distance)
  }

  getGuessFactor(target) {                                                   
    const headingToEnemy = Math.atan2(target.x - this.x, -(target.y - this.y))
    const bearingToEnemy = normalRelativeAngleRadians(headingToEnemy - this.bearing)                                                              
    return Math.max(-1, Math.min(1, bearingToEnemy / this.maxEscapeAngle)) * this.direction                                                             
  }
}

class GunManager {
  waveBullets = []
  stats = Array(GUESS_FACTOR_SIZE).fill(0)

  run(me, target) {
    if(me && target) {
      // Process existing waves first
        const newWaveBullets = []                                                  
        for (const wave of this.waveBullets) {
          if (wave.hasReached(target)) {
            const guessFactor = wave.getGuessFactor(target)
            const index = Math.round((GUESS_FACTOR_SIZE - 1) /2 * (guessFactor + 1))
            this.stats[index]++                              
          } else {                                                                 
            newWaveBullets.push(wave)                                              
          }                                                                        
        }                    
        this.waveBullets = newWaveBullets

        // Then add the new wave for this tick
        const absBearing = me.angleToRadians(target)
        const enemyDirection = Math.sin(target.heading * Math.PI / 180 - absBearing) * target.velocity < 0 ? -1 : 1                                 
        this.waveBullets.push(new WaveBullet(me.x, me.y, absBearing, enemyDirection, me.bulletSpeed(1.0)))
    
        if (me.gunHeat === 0) {
          let bestGF = 15 // Defaults to dead ahead
          for (let i = 0; i < this.stats.length; i++) {
            if (this.stats[i] > this.stats[bestGF]) {
              bestGF = i
            }
          }
          const guessFactor = (bestGF - (this.stats.length - 1) / 2) / ((this.stats.length - 1) / 2)
          const angleOffset = enemyDirection * guessFactor * this.waveBullets[0].maxEscapeAngle
          const gunOffset = normalRelativeAngleRadians(me.gunBearingToRadians(target) + angleOffset)
          //console.log("Guess Factor: ", guessFactor, "Angle: ", angleOffset, "Gun Offset: ", gunOffset)
          me.setTurnGunRadians(gunOffset)
          
          if(gunOffset < Math.atan2(10, me.distanceTo(target))) {
            me.setFire(1.0) 
          }
        }
        for (let i = 0; i < this.stats.length; i++) {
          this.stats[i] *= 0.995
        }
    }
  }
}

class OrbitMovementManager {
  constructor() {
    this.direction = 1
    this.distance = 260
  }

  avoidObstacles(me, angle) {
    let correctAngle = me.headingRadians + (angle * Math.PI / 180)
    while(true) {
      //Project out DISTANCE_FROM_WALL units
      const x = me.x + (DISTANCE_FROM_WALL * this.direction) * Math.sin(correctAngle)
      const y = me.y - (DISTANCE_FROM_WALL * this.direction) * Math.cos(correctAngle)
      //console.log(`Current position: ${Math.trunc(me.x)}, ${Math.trunc(me.y)}`)
      //console.log(`Projected position: ${Math.trunc(x)}, ${Math.trunc(y)}`)
      if (x < LEFT_WALL || x > RIGHT_WALL || y < TOP_WALL || y > BOTTOM_WALL) {
        //Turn a bit towards the enemy by 0.1 radians
        correctAngle += this.direction * 0.1
      }
      else {
        break
      }
    }
    return (correctAngle - me.headingRadians) * 180 / Math.PI
  }

  run(me, target) {
    //Handle orbiting
    const correction = (me.distanceTo(target) - this.distance) / 20 * this.direction                     
    const desiredBearing = me.bearingTo(target) - 90 + correction
    const correctedBearing = this.avoidObstacles(me, desiredBearing)
    me.setTurn(correctedBearing)

    //Handle velocity
    if (me.remainingAhead === 0) {
      this.direction *= -1
      me.setMove((40 + Math.random() * 180) * this.direction)
    }
  }
}

class SunTzu extends Robot {
  gun = new GunManager()
  omm = new OrbitMovementManager()

  async run() {
    while(true) {
      const target = this.enemies.filter(e => (
        e.visible && e.alive)).sort(
        (a, b) => (this.distanceTo(a) - this.distanceTo(b))
      )[0]

      if(target) {
        this.gun.run(this, target)
        this.omm.run(this, target)
      }
      await this.execute()
    }
  }

  logHistogram(label = 'GF') {                               
    const max = Math.max(...this.gun.stats)                                           
    if (max === 0) return                                                    
    const width = 20                                                         
    const bars = this.gun.stats.map((v, i) => {                                       
      const filled = Math.round((v / max) * width)
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled)            
      const gf = ((i / (this.gun.stats.length - 1)) * 2 - 1).toFixed(2)               
      return `${gf.padStart(6)} |${bar}| ${v}`                               
    })                                                                       
    console.log(`--- ${label} ---\n` + bars.join('\n'))                      
  }

  onBattleEnd() {
    console.log("Battle's over")
    if (DEBUG) this.logHistogram()
  }
}