(function () {
    const vscode = acquireVsCodeApi();
    
    const previousState = vscode.getState();
    if (previousState && previousState.message) {        
        processMessage(previousState.message);
    }    

    window.addEventListener('message', event => {
        console.log(event);

        const message = event.data;
        vscode.setState({message});
        processMessage(message);
    });

    function processMessage(message) {        
        const content = document.getElementById('content');
        
        content.innerHTML = '';

        switch (message.command) {
            case 'show_spinner':
                let spinnerDiv = document.createElement('div');
                spinnerDiv.className = 'loader';

                content.appendChild(spinnerDiv);
                break;

            case 'show_error': {
                let errorText = message.data['message'];
                let code = message.data['code'];
                let body = message.data['body'];

                if (code !== undefined) {
                    errorText += ` (${code})`;
                }

                let errorElement = document.createElement('text');
                errorElement.textContent = errorText;
                content.appendChild(errorElement);
                if (body !== null) {
                    content.appendChild(document.createElement('br'));
                    content.appendChild(document.createElement('br'));
                    let bodyElement = document.createElement('text');
                    bodyElement.textContent = body;
                    content.appendChild(bodyElement);
                }

                break;
            }

            case 'show_results': {
                let rows = message.data['data'];
                let meta = message.data['meta'];
                let statistics = message.data['statistics'];                

                let tbl = document.createElement('table');
                tbl.style.width = '100%';
                tbl.setAttribute('border', '1');
                let tbdy = document.createElement('tbody');

                let headerRow = document.createElement('tr');
                for (var i = 0; i < meta.length; i++) {
                    let headerTd = document.createElement('td');
                    headerTd.appendChild(document.createTextNode(meta[i]['name']));
                    headerRow.appendChild(headerTd);
                }
                tbdy.appendChild(headerRow);

                for (var i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    let tr = document.createElement('tr');

                    for (var n = 0; n < row.length; n++) {
                        let item = row[n];
                        let td = document.createElement('td');
                        td.appendChild(document.createTextNode(item));
                        tr.appendChild(td);
                    }

                    tbdy.appendChild(tr);
                }
                tbl.appendChild(tbdy);

                content.appendChild(tbl);
                content.appendChild(document.createElement('br'));

                let summaryElement = document.createElement('text');
                summaryElement.textContent = `Query execution time: ${Math.round(statistics['elapsed'] * 1000)} ms; Affected rows: ${statistics.rows_read}; Result rows: ${message.data['rows']}`;
                content.appendChild(summaryElement);

                break;
            }
        }
    };
}());