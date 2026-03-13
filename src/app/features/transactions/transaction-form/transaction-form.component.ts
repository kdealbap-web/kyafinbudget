import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-transaction-form',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './transaction-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFormComponent {
}
