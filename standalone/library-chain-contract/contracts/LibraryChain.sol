// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import '@openzeppelin/contracts/utils/Strings.sol';

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract LibraryChain {
    uint256 public bookCounter;
    address payable public owner;

    constructor() {
        bookCounter = 0;
        owner = payable(msg.sender);
    }

    enum BookStatus {
        AVAILABLE,
        BORROWED,
        RESERVED,
        LOST
    }

    struct Book {
        uint256 id;
        string name;
        uint256 quantity;
        address publisher;
        Chapter[] chapters;
    }

    struct Chapter {
        string name;
        uint256 pageCount;
    }

    struct BookItem {
        string id;
        uint256 bookId;
        BookStatus status;
    }

    struct Publisher {
        string name;
        string location;
        string contact;
    }

    mapping(uint256 => Book) public books;
    mapping(string => BookItem) public bookItems;
    mapping (address => string[]) public inventory;
    mapping (address => Publisher) public publishers;
    mapping(string => address) public borrowedBy;

    event BookCreated(uint256 bookId, string name, address publisher);
    event ChapterCreated(uint256 bookId, string name, uint256 pageCount);
    event BookItemsAdded(string[] itemIds, uint256 bookId);
    event BookItemsStatusChanged(string[] itemIds, BookStatus status);
    event PublisherRegistered(
        address publisher,
        string name,
        string location,
        string contact
    );

    function registerPublisher(
        string memory _name,
        string memory _location,
        string memory _contact
    ) public {
        require(bytes(_name).length > 0, 'Publisher name cannot be empty');
        require(
            bytes(publishers[msg.sender].name).length == 0,
            'Publisher already registered'
        );

        Publisher memory newPublisher = Publisher({
            name: _name,
            location: _location,
            contact: _contact
        });

        publishers[msg.sender] = newPublisher;

        emit PublisherRegistered(msg.sender, _name, _location, _contact);
    }

    function addBook(
        string memory _name,
        string[] memory chapterNames,
        uint256[] memory chapterPagesCount
    ) public {
        require(bytes(_name).length > 0, 'Book name cannot be empty');
        require(
            chapterNames.length == chapterPagesCount.length,
            'Chapters array length mismatch'
        );

        require(
            bytes(publishers[msg.sender].name).length > 0,
            'Publisher not registered'
        );

        bookCounter++;

        uint256 bookId = bookCounter;

        Book storage newBook = books[bookId];
        newBook.id = bookId;
        newBook.name = _name;
        newBook.quantity = 0;
        newBook.publisher = msg.sender;

        emit BookCreated(bookId, _name, msg.sender);

        for (uint256 i = 0; i < chapterNames.length; i++) {
            Chapter memory chapter = Chapter({
                name: chapterNames[i],
                pageCount: chapterPagesCount[i]
            });

            books[bookId].chapters.push(chapter);

            emit ChapterCreated(bookId, chapterNames[i], chapterPagesCount[i]);
        }
    }

    function addBookItems(uint256 _bookId, uint256 _quantity) public {
        require(
            _quantity <= 10,
            'Cannot add more than 10 books items at a time.'
        );

        require(
            msg.sender == books[_bookId].publisher,
            'Only the book publisher can add book items.'
        );

        require(
            bytes(books[_bookId].name).length > 0,
            'Book does not exist.'
        );


        string[] memory newBookItemIds = new string[](_quantity);

        for(uint256 i = 0; i < _quantity; i++) {
            string memory itemId = string(
                abi.encodePacked(
                    Strings.toString(_bookId),
                    '-',
                    Strings.toString(books[_bookId].quantity + i + 1)
                )
            );

            BookItem memory newItem = BookItem({
                id: itemId,
                bookId: _bookId,
                status: BookStatus.AVAILABLE
            });

            bookItems[itemId] = newItem;
            inventory[msg.sender].push(itemId);
            newBookItemIds[i] = itemId;
        }

        books[_bookId].quantity += _quantity;

        emit BookItemsAdded(newBookItemIds, _bookId);
    }

    function sellBookItems(string[] memory itemIds) public {
        for (uint256 i = 0; i < itemIds.length; i++) {
            string memory itemId = itemIds[i];
            uint256 bookId = bookItems[itemId].bookId;

            require(
                bookItems[itemId].bookId != 0,
                'Book item does not exist.'
            );

            require(
                msg.sender == books[bookId].publisher,
                'Only the book publisher can sell book items.'
            );

            require(
                bookItems[itemIds[i]].status == BookStatus.RESERVED || bookItems[itemIds[i]].status == BookStatus.AVAILABLE,
                'Book item cannot be sold.'
            );

            bookItems[itemIds[i]].status = BookStatus.BORROWED;
        }

        emit BookItemsStatusChanged(itemIds, BookStatus.BORROWED);
    }

    function returnBookItems(string[] memory itemIds) public {
        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 bookId = bookItems[itemIds[i]].bookId;

            require(
                bookItems[itemIds[i]].status == BookStatus.BORROWED || bookItems[itemIds[i]].status == BookStatus.LOST,
                'Book item cannot be returned'
            );

            require(
                msg.sender == books[bookId].publisher,
                'Only the product publisher can sell book items.'
            );

            bookItems[itemIds[i]].status = BookStatus.AVAILABLE;
        }

        emit BookItemsStatusChanged(itemIds, BookStatus.AVAILABLE);
    }

    function borrowBookItem(string[] memory itemIds) public {
        for (uint256 i = 0; i < itemIds.length; i++) {
            require(
                bookItems[itemIds[i]].status == BookStatus.AVAILABLE,
                'Book item is not available for borrowing.'
            );

            bookItems[itemIds[i]].status = BookStatus.BORROWED;
        }

        emit BookItemsStatusChanged(itemIds, BookStatus.BORROWED);
    }
}
