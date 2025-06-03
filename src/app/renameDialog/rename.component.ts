import { Component, input } from '@angular/core'
import { DialogModule } from 'primeng/dialog'
import { ButtonModule } from 'primeng/button'
import { InputTextModule } from 'primeng/inputtext'
import { CommonModule } from '@angular/common'

@Component({
  selector: 'app-rename-dialog',
  imports: [ButtonModule, CommonModule, DialogModule, InputTextModule],
  templateUrl: './rename.component.html',
})
export class RenameComponent {
  progress = input(0)
  message = 'Loading...'
  visible = true
}
