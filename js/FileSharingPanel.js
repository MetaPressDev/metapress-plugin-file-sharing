import React, { useEffect, useRef, useState } from 'react'
import { formatFileSize } from './utils'

/** File sharing panel */
export const FileSharingPanel = props => {

    // File selector
    const fileSelector = useRef(null)
    const [ stateCounter, setStateCounter ] = useState(0)

    // Create list of shared files
    let files = []
    for (let key in metapress.etherealStorage.data) {

        // Check if it's ours
        if (!key.startsWith('sharedFiles/'))
            continue

        // Check if valid
        let file = metapress.etherealStorage.data[key]
        if (!file || !file.uuid || !file.name || !file.size || !file.owner)
            continue

        // Check if we have a peer connection to the owner of this file
        let peer = metapress.p2p.connections.find(c => c.instanceID == file.owner)
        let hasPeerConnection = peer?.state == 'connected'

        // Check if it's our own file
        let isOurFile = file.owner == metapress.instanceID

        // Check if we've already downloaded this file
        let hasDownloaded = false//metapress.fileSharing.downloads[file.uuid]

        // Stop if we have no connection and have not downloaded the file
        if (!hasPeerConnection && !hasDownloaded && !isOurFile)
            continue

        // Add this file
        files.push(file)

    }

    // Sort files by date, newest first
    files.sort((a, b) => b.date - a.date)

    // Add listener for state changes from the plugin
    useEffect(() => {

        // On update callback
        const onUpdate = e => setStateCounter(i => i + 1)

        // Add listener
        window.addEventListener('metapress.fileSharing.update', onUpdate)

        // Remove listener on unmount
        return () => window.removeEventListener('metapress.fileSharing.update', onUpdate)

    }, [])

    // Called when the user clicks on the Upload a File button
    const onUploadFileClick = e => {
        e.preventDefault()

        // Activate the file selector
        fileSelector.current.value = null
        fileSelector.current.click()

    }

    // Called when the user has selected a file from the file selector input field
    const onSelectFile = e => {
        e.preventDefault()

        // Send files to the plugin to be shared
        for (let i = 0 ; i < fileSelector.current.files.length ; i++)
            metapress.fileSharing.shareFile(fileSelector.current.files[i])

    }

    /** Called on dragging a file over */
    const onDragOver = e => {
        e.preventDefault()
        e.stopPropagation()
    }

    /** Called on file drop */
    const onDrop = e => {
        e.preventDefault()
        e.stopPropagation()

        // Get the files
        let files = e.dataTransfer.files
        for (let i = 0 ; i < files.length ; i++)
            metapress.fileSharing.shareFile(files[i])

    }

    /** Called when the user wants to download a file */
    const onDownloadFile = (e, file) => {
        e.preventDefault()
        e.stopPropagation()

        // Download the file
        metapress.fileSharing.downloadAndSaveFile(file.uuid)

        // Close the panel
        metapress.menubar.closePanel()

    }

    /** Called when the user clicks the delete button on a file */
    const onDeleteFile = (e, file) => {
        e.preventDefault()
        e.stopPropagation()

        // Stop sharing the file
        metapress.fileSharing.stopSharing(file.uuid)

    }

    // Render UI
    return <PanelContainer title='File Sharing' onClose={() => metapress.menubar.closePanel()} onDragOver={onDragOver} onDrop={onDrop} >

        {/* Header */}
        <img src={require('./images/shared-folder.svg')} style={{ display: 'block', height: 64, margin: '30px auto 30px auto' }} />
        <div style={{ fontSize: 15, textAlign: 'center', margin: '0px 20px' }}>File Sharing</div>
        <div style={{ fontSize: 13, textAlign: 'center', margin: '5px 20px 30px 20px', opacity: 0.5, lineHeight: 1.5 }}>Drop a file here to share it with other users in the world.</div>

        {/** create a dropZone */}
        {/* <div id="dropzone" onDragOver={e => this.onDragOverHandler(e)} onDrop={ e => this.onDropHandler(e)} style={{ position: 'absolute', top: 30, margin: '30px 40px', width: 'calc(100% - 90px)', height: '300px', border: '2px dashed #858383', textAlign: 'center', cursor: 'pointer' }} >
            
            <img draggable='false' src={require('./images/upload-file.png')} style={{ width: 40, height: 40, margin: '50px auto 10px auto', justifyContent: 'center' }} />
            
            <div style={{ fontSize: 13, margin: '10px auto', flex: '1 1 1px' }}>
                Drag & Drop a file <br/>
                or <br/>
                <p onClick={() => document.getElementById('file-input').click()} style={{ fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', margin: 'auto' }}> Browse a file </p>
            </div>
            
            <input type="file" id="file-input" onChange={e => this.handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div> */}

        {/* Select a file */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '0px 20px 10px 20px', height: 60, border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: 8, cursor: 'pointer' }} onClick={onUploadFileClick}>
            <img src={require('./images/add.svg')} style={{ height: 14, margin: '0px 10px 0px 0px', opacity: 0.5 }} />
            <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>Upload a file</div>
        </div>

        {/* Hidden file selector */}
        <input type="file" ref={fileSelector} onChange={onSelectFile} style={{ display: 'none' }} multiple />

        {/* List of shared files */}
        {files.map(file =>
            <FileItem key={file.uuid} file={file} onClick={e => onDownloadFile(e, file)} onDelete={e => onDeleteFile(e, file)} />
        )}

    </PanelContainer>

}

/** Renders a file item in the list */
const FileItem = props => {

    // Get file icon based on file extension
    let lowerName = props.file.name.toLowerCase()
    let icon = require('./images/ext-icons/file.png')
    if (lowerName.endsWith('.ai'))      icon = require('./images/ext-icons/ai.png')
    if (lowerName.endsWith('.apk'))     icon = require('./images/ext-icons/apk.png')
    if (lowerName.endsWith('.avi'))     icon = require('./images/ext-icons/avi.png')
    if (lowerName.endsWith('.css'))     icon = require('./images/ext-icons/css.png')
    if (lowerName.endsWith('.csv'))     icon = require('./images/ext-icons/csv.png')
    if (lowerName.endsWith('.dbf'))     icon = require('./images/ext-icons/dbf.png')
    if (lowerName.endsWith('.doc'))     icon = require('./images/ext-icons/doc.png')
    if (lowerName.endsWith('.docx'))    icon = require('./images/ext-icons/doc.png')
    if (lowerName.endsWith('.dwg'))     icon = require('./images/ext-icons/dwg.png')
    if (lowerName.endsWith('.exe'))     icon = require('./images/ext-icons/exe.png')
    if (lowerName.endsWith('.fla'))     icon = require('./images/ext-icons/fla.png')
    if (lowerName.endsWith('.htm'))     icon = require('./images/ext-icons/html.png')
    if (lowerName.endsWith('.html'))    icon = require('./images/ext-icons/html.png')
    if (lowerName.endsWith('.ipa'))     icon = require('./images/ext-icons/ipa.png')
    if (lowerName.endsWith('.iso'))     icon = require('./images/ext-icons/iso.png')
    if (lowerName.endsWith('.jpg'))     icon = require('./images/ext-icons/jpg.png')
    if (lowerName.endsWith('.jpeg'))    icon = require('./images/ext-icons/jpg.png')
    if (lowerName.endsWith('.js'))      icon = require('./images/ext-icons/js.png')
    if (lowerName.endsWith('.json'))    icon = require('./images/ext-icons/json.png')
    if (lowerName.endsWith('.mp3'))     icon = require('./images/ext-icons/mp3.png')
    if (lowerName.endsWith('.mp4'))     icon = require('./images/ext-icons/mp4.png')
    if (lowerName.endsWith('.m4v'))     icon = require('./images/ext-icons/mp4.png')
    if (lowerName.endsWith('.pdf'))     icon = require('./images/ext-icons/pdf.png')
    if (lowerName.endsWith('.png'))     icon = require('./images/ext-icons/png.png')
    if (lowerName.endsWith('.ppt'))     icon = require('./images/ext-icons/ppt.png')
    if (lowerName.endsWith('.pptx'))    icon = require('./images/ext-icons/ppt.png')
    if (lowerName.endsWith('.psd'))     icon = require('./images/ext-icons/psd.png')
    if (lowerName.endsWith('.rtf'))     icon = require('./images/ext-icons/rtf.png')
    if (lowerName.endsWith('.svg'))     icon = require('./images/ext-icons/svg.png')
    if (lowerName.endsWith('.txt'))     icon = require('./images/ext-icons/txt.png')
    if (lowerName.endsWith('.xls'))     icon = require('./images/ext-icons/xls.png')
    if (lowerName.endsWith('.xlsx'))    icon = require('./images/ext-icons/xls.png')
    if (lowerName.endsWith('.xml'))     icon = require('./images/ext-icons/xml.png')
    if (lowerName.endsWith('.zip'))     icon = require('./images/ext-icons/zip.png')
    if (lowerName.endsWith('.7z'))      icon = require('./images/ext-icons/zip.png')
    if (lowerName.endsWith('.rar'))     icon = require('./images/ext-icons/zip.png')
    if (lowerName.endsWith('.tar'))     icon = require('./images/ext-icons/zip.png')
    if (lowerName.endsWith('.tar.gz'))  icon = require('./images/ext-icons/zip.png')

    // Get status
    let status = `${formatFileSize(props.file.size)} - ${props.file.ownerName || 'Guest'}`

    // Check if currently transferring
    let transfer = metapress.fileSharing.transfers.find(t => t.fileID == props.file.uuid && !t.isSending && !t.error)
    if (transfer)
        status = `Downloading ${formatFileSize(transfer.transferredBytes)} / ${formatFileSize(transfer.totalBytes)}`

    // Render UI
    return <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '0px 20px 10px 20px', height: 60, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 8, cursor: 'pointer' }} onClick={props.onClick}>
        
        {/* Icon */}
        <div style={{ flex: '0 0 auto', width: 60, height: 60, backgroundColor: 'rgba(0, 0, 0, 0.1)', margin: '0px 10px 0px 0px', backgroundImage: 'url(' + icon + ')', backgroundSize: '32px', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />

        {/* Text */}
        <div style={{ flex: '1 1 1px', margin: '0px 10px 0px 0px', overflow: 'hidden' }}>
            <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', whiteSpace: '', textWrap: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0 }}>{props.file.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', whiteSpace: 'pre', textWrap: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0 }}>{status}</div>
        </div>

        {/* If we are the owner of the file, add a remove button */}
        { props.file.owner == metapress.instanceID ? 
            <div style={{ width: 32, alignSelf: 'stretch', backgroundImage: 'url(' + require('./images/close.svg') + ')', backgroundSize: '16px', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', cursor: 'pointer', opacity: 0.5 }} onClick={props.onDelete} />
        : null }

    </div>

}


/** 
 * Container for a panel.
 * @param {object} props Panel container properties.
 * @param {string} props.title The title of the panel.
 * @param {React.ReactNode} props.children The children of the panel.
 * @param {React.CSSProperties=} props.containerStyle Additional styling to apply to the container.
 * @param {Function=} props.onClose Function to execute when the close button is clicked.
 */
export const PanelContainer = props => {

    // Return UI
    return <>
    
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', top: 0, left: 0, width: '100%', height: 44, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }} onDragOver={props.onDragOver} onDrop={props.onDrop}>

            {/* Title */}
            <div style={{ fontSize: 15, margin: '0px 20px', flex: '1 1 1px' }}> { props.title } </div>

            {/* Only show close button if there is a close function */}
            { props.onClose != null
                ? <img draggable='false' src={require('./images/close.svg')} title='Close' style={{ width: 20, height: 20, marginRight: 15, cursor: 'pointer' }} onClick={props.onClose} />
                : null
            }

        </div>

        {/* Scrollable content */}
        <div style={{ position: 'absolute', top: 45, left: 0, width: '100%', height: 'calc(100% - 45px)', overflowX: 'hidden', overflowY: 'auto' }} onDragOver={props.onDragOver} onDrop={props.onDrop}>
            {props.children}
        </div>

    </>

}