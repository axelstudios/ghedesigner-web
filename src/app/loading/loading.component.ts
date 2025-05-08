import { Component, effect, input } from '@angular/core'
import { DialogModule } from 'primeng/dialog'
import { ButtonModule } from 'primeng/button'
import { InputTextModule } from 'primeng/inputtext'
import { ProgressBarModule } from 'primeng/progressbar'
import { CommonModule } from '@angular/common'

@Component({
  selector: 'app-loading',
  imports: [ButtonModule, CommonModule, DialogModule, InputTextModule, ProgressBarModule],
  templateUrl: './loading.component.html',
})
export class LoadingComponent {
  progress = input(0)
  message = 'Loading...'
  visible = true

  constructor() {
    effect(() => {
      if (this.progress() === 100) {
        setTimeout(() => {
          this.visible = false
        }, 150)
      }
    })
  }
}
